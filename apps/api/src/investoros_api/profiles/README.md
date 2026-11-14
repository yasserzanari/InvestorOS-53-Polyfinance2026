# Profile conversation API

This module owns `/v1/profiles/*`. It calls **Amazon Bedrock** with the server credential chain; the browser never receives AWS credentials. There is no simulated-response fallback.

## Files and extension points

- `router.py`: FastAPI routes and NDJSON encoding.
- `models.py`: bounded browser input, profile fields and workspace schema.
- `service.py`: actual ConverseStream tool loop and optional specialist Converse calls.
- `tools.py`: allowlisted tool declarations. Add a schema **and** validated implementation when introducing a tool.
- `sources.py`: exact product methodology excerpts and citation URLs. Replace this repository with a retrieval adapter to add Bedrock Knowledge Bases. No web search is implemented.

## Configuration

Set `BEDROCK_MODEL_ID` to an accessible model or inference profile supporting ConverseStream tool use, plus `AWS_REGION`. Local credentials come from the normal boto3 chain. Use a workload role in AWS with `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` scoped to the configured model/inference profile and its destination model ARNs. The API status route reports configuration presence, **not** a verified permission or model availability check.

The local dev API can run with `PYTHONPATH=apps/api/src uvicorn investoros_api.main:app --host 127.0.0.1 --port 8010`. Configure Vite's `/api` proxy to this server.

## HTTP contract (v1)

`POST /v1/profiles/chat`:

```json
{"accountId":"mateo","message":"Je prépare ma retraite dans 15 ans.","history":[],"profile":{},"tabs":[]}
```

`history` contains at most 30 `{role: "user"|"assistant", content: string}` messages. `profile` contains only the eight supported string fields. `tabs` holds at most 12 validated workspaces:

```json
{"id":"synthese","title":"Synthèse","kind":"note","content":"Texte","items":[]}
```

Tab kinds: `profile`, `note`, `tasks`, `agents`, `sources`. Items: `{id,title,status,url?}` with status `pending|active|done|failed|skipped`. Render strings as text, never arbitrary HTML. URLs are untrusted; the browser must allow only safe `http(s)` and known local API links.

The response is newline-delimited UTF-8 JSON (`application/x-ndjson`); read lines incrementally. Events:

| type | payload |
| --- | --- |
| `status` | `label` (real runtime stage, no private reasoning) |
| `text` | `delta` (actual model output fragment) |
| `tool` | `id,name,status,input,output?,error?` (`running|done|failed`) |
| `agent` | `id,name,status,task,startedAt,summary?,durationMs?` |
| `workspace` | complete `profile,tabs` snapshot after validated modifications |
| `sources` | `citations:[{id,index,title,url,snippet}]` of catalog documents actually read |
| `followups` | `prompts:[{id,label}]` selected by the model |
| `done` | `modelId,usage:{inputTokens,outputTokens}` summed over orchestrator and specialists |
| `error` | `code,message`; partial tool changes remain available |

An HTTP 200 does not imply the model succeeded: consumers must require `done` and handle error/truncated streams. HTTP 422 means invalid request data. Follow-ups send a new chat turn; regeneration replays context before the target assistant turn. The runtime returns explanatory operation records, never hidden model reasoning.

## Runtime behavior and limits

`analyze_demo_portfolio` reads only the fixed portfolio configured for the deployment and deterministically computes position weights and concentration. It validates the stated total and position values, returns its fixture provenance and links to the portfolio module. It does not calculate returns or historical risk without a price history, and the configured portfolio may not match the selected chat persona. `update_profile` updates only allowlisted fields. `upsert_tab` creates or replaces by id. `read_sources` returns verbatim notes from the catalog; the model can reference their stable per-turn `[index]`. `suggest_followups` publishes up to three questions. `run_specialist` performs an actual separate Bedrock call limited to two consultations per turn. There is no browser agent, image capture or invented browser preview. The UI should show the actual specialist result when no browser tool has run.

The orchestrator allows six model rounds and explicitly caps output tokens per call. Configuration, AWS denial, throttling and incomplete responses produce explicit errors. Prompt data and tool outputs are untrusted; all changes are validated server-side and there is no arbitrary network access or code execution.

## Persistence and deployment

The request carries the current demo workspace; this module is stateless. Browser persistence is owned by the frontend. This endpoint does not establish a production user identity or write DynamoDB records. Bind the local development server to loopback and expose it through the frontend development proxy. Production requires an authenticated account context, request rate limits and durable workspace storage.

FastAPI StreamingResponse streams locally. The existing Mangum Lambda/API Gateway adapter may buffer NDJSON responses. Streaming production deployment requires a streaming-capable adapter/transport; the Lambda timeout must also allow multiple model rounds. Do not claim production token streaming simply because this local endpoint streams.

## Questions interactives : `ask_user`

L’assistant appelle `ask_user` lorsqu’une information du profil doit être précisée.
Il choisit le format adapté à l’information : `single_choice` pour une réponse
exclusive (par exemple l’horizon), `multiple_choice` pour plusieurs besoins ou
préférences compatibles, `text` pour une situation personnelle ou les conséquences
d’une perte. Les choix restent neutres et ne sont jamais présélectionnés. Les
questions portent sur les inconnues utiles dans ce contexte, sans redemander les
faits déjà donnés. Les suggestions de suivi facultatives sont distinctes de ce
formulaire et ne servent plus de questionnaire en prose.

Entrée de l’outil (validée avec `AskUserInput`) :

```json
{
  "title": "Précisons votre horizon",
  "description": "Pour distinguer les projets proches de l’épargne de long terme.",
  "questions": [{
    "id": "horizon",
    "label": "Quand pensez-vous utiliser cet argent?",
    "kind": "single_choice",
    "options": [
      {"id": "near", "label": "Dans les trois prochaines années"},
      {"id": "later", "label": "Dans huit ans ou plus"}
    ],
    "required": true,
    "allowOther": true,
    "placeholder": "Un autre horizon, ou une situation encore incertaine…"
  }]
}
```

Le serveur ajoute un identifiant unique et émet
`{"type":"questions","request":{"id":"…","title":"…","questions":[…]}}`.
Le tour se termine ensuite avec `done.awaitingUser=true` et
`done.questionRequestId`. Aucun texte de réponse utilisateur ni résultat d’outil
fictif n’est renvoyé au modèle. Les opérations réalisées avant la question restent
disponibles dans les événements workspace. Les outils suivants éventuellement
présents dans le même lot ne sont pas exécutés après cette suspension.

Pour reprendre, le frontend envoie un nouveau `POST /v1/profiles/chat` contenant
les champs ordinaires et les deux champs suivants :

```json
{
  "questionRequest": {
    "id": "request-uuid",
    "title": "Précisons votre horizon",
    "questions": [{
      "id": "horizon", "label": "Quand pensez-vous utiliser cet argent?",
      "kind": "single_choice", "required": true, "allowOther": true,
      "options": [{"id":"near","label":"Dans trois ans"},{"id":"later","label":"Dans huit ans ou plus"}]
    }]
  },
  "questionAnswer": {
    "requestId": "request-uuid",
    "answers": [{"questionId":"horizon","selectedOptionIds":["later"],"text":""}]
  }
}
```

Les identifiants de demande, de questions et de choix doivent correspondre. Une
question obligatoire ne peut pas être vide; une question facultative peut être
omise. Une réponse développée n’accepte pas de choix; un choix unique accepte au
plus une option. La réponse libre des questions à choix est acceptée seulement si
`allowOther=true`. Les listes de questions, options et réponses sont bornées et
les identifiants répétés sont rejetés. Les erreurs de soumission sont des réponses
HTTP 422, avant tout appel AWS.

Le serveur reste sans état : `questionRequest` est le schéma validé du formulaire
transmis par le client, pas une preuve signée de création. Ces données ne donnent
aucun droit supplémentaire. Les libellés et choix réellement fournis sont ajoutés
au prochain message **utilisateur** sous forme de données structurées; le prompt
système reste détenu par le serveur. Le modèle enregistre ensuite les faits
explicitement déclarés avec `update_profile`.

Tests sans réseau :

```sh
PYTHONPATH=apps/api/src python -m unittest discover -s apps/api/tests -v
```
