# Profile conversation API

This module owns `/v1/profiles/*`. It calls **Amazon Bedrock** with the server credential chain; the browser never receives AWS credentials. There is no simulated-response fallback.

## Files and extension points

- `router.py`: FastAPI routes and NDJSON encoding.
- `models.py`: bounded browser input, profile fields and workspace schema.
- `service.py`: actual ConverseStream tool loop and optional specialist Converse calls.
- `tools.py`: allowlisted tool declarations. Add a schema **and** validated implementation when introducing a tool.
- `sources.py`: exact product methodology excerpts and citation URLs. Replace this repository with a retrieval adapter to add Bedrock Knowledge Bases. External research is available through the DEV2 adapter when RESEARCH_API_URL is configured; see SKILLS.md.

## Configuration

Set `BEDROCK_MODEL_ID` to an accessible model or inference profile supporting ConverseStream tool use, plus `AWS_REGION`. Local credentials come from the normal boto3 chain. Use a workload role in AWS with `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` scoped to the configured model/inference profile and its destination model ARNs. The API status route reports configuration presence, **not** a verified permission or model availability check.

The local dev API launcher sets `DEMO_PORTFOLIO_MODE=local_fixture` and uses the
same versioned persona fixture that Terraform seeds into DynamoDB. Portfolio tools
therefore work with explicitly labeled fictional data during local Bedrock
conversations. AWS Lambda sets `DEMO_PORTFOLIO_MODE=dynamodb`; local fixtures are
rejected whenever the Lambda runtime marker is present. Configure Vite's `/api`
proxy to this server.

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

`analyze_demo_portfolio` resolves the active persona from the shared fictional
fixture file in local development or from deployment-owned `DEMO_CONTEXTS` and
DynamoDB in AWS. It deterministically computes position weights and concentration,
validates totals, and returns the source classification. It does not calculate
returns or historical risk without a price history. `update_profile` updates only
allowlisted fields. `upsert_tab` creates or replaces by id. `read_sources` returns
verbatim notes from the catalog; the model can reference their stable per-turn
`[index]`. `suggest_followups` publishes up to three questions. `run_specialist`
performs an actual separate Bedrock call limited to two consultations per turn.
There is no direct browser execution or image capture in this chat module; DEV2 may use its own controlled research tools. The UI
should show the actual specialist result when no browser tool has run.

The orchestrator allows ten model rounds and explicitly caps output tokens per call. Configuration, AWS denial, throttling and incomplete responses produce explicit errors. Prompt data and tool outputs are untrusted; all changes are validated server-side and there is no arbitrary network access or code execution.

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

## Skills métier (runtime actuel)

Voir [SKILLS.md](SKILLS.md) pour le catalogue, sa synchronisation depuis le dépôt
InvestorOS-skills, les outils search_skills/load_skill, les limites d’exécution
et la connexion optionnelle au moteur de recherche DEV2 via RESEARCH_API_URL.
Le catalogue est embarqué dans le paquet Lambda; aucune installation distante
n’est effectuée par l’agent. La boucle est désormais bornée à dix tours pour
permettre découverte, chargement et action dans une même demande.

## Suivi de recherche dans l’Assistant

Après `start_analysis`, le client conserve l’identifiant et suit l’exécution par
`GET /v1/profiles/research/{analysis_id}?accountId=mateo`. Cette route lit le
résultat et les événements du moteur DEV2 avec le contexte du compte; elle ne
relance pas l’analyse. Le suivi s’arrête à un état terminal, après trois erreurs
consécutives ou après trois minutes. Le bouton d’actualisation reprend la lecture.

Les onglets **Agents**, **Skills utilisés** et **Résultats de recherche** montrent
les événements réellement retournés : agents Bedrock distincts des collecteurs,
procédures chargées avec version/empreinte et acteur (modèle ou runtime), synthèse,
affirmations et liens vers les preuves. Ils restent fermés lors de l’envoi d’un
message jusqu’à une ouverture explicite. Le suivi est conservé dans l’espace local
du compte et peut être ouvert avec `/app/assistant?analysis_id=<UUID>`.

Validation du 15 novembre 2026 : soumission réelle depuis l’Assistant de la demande
NVDA pour la semaine prochaine (recherche documentaire, sans projection chiffrée),
analyse `3ca004a7-6a66-4c8e-b82a-9d751a058c0a` terminée, six intervenants,
17 affirmations et trois preuves. Playwright a vérifié les trois onglets, la
persistance après rechargement et l’accès direct depuis une session vierge sans
nouvelle création d’analyse. Les 47 tests API ciblés et le contrôle TypeScript
passent. Une recherche terminée ne garantit pas la présence d’informations sur
chaque événement futur : les limites des sources restent celles du résultat.

## Profils X autorisés et citations

Le contexte de chaque tour charge les profils autorisés via `source_store.read_workspace(request.accountId)` (SQLite local, DynamoDB en AWS). Le modèle peut les relire avec `list_authorized_x_profiles`, puis utiliser `read_authorized_x_posts` avec un sujet et, facultativement, des usernames. Le serveur relit les autorisations avant chaque collecte et refuse tout auteur extérieur à la liste; le modèle ne peut pas choisir un autre persona. Les appels sont bornés à huit auteurs par collecte et trois collectes par tour, sans limiter la taille de la liste autorisée.

En AWS, `x_evidence.py` appelle par IAM le worker de recherche dans le VPC; celui-ci apprend ou réutilise le template `x-public-timeline.getRecentPosts` via le proxy REST API Anything et renvoie seulement les publications normalisées. La Lambda de chat ne reçoit ni l’URL interne ni le jeton du proxy, et n’a pas besoin de Node ou Chrome. Le développement local sans worker configuré conserve le lecteur HTTP versionné comme solution de repli. La lecture prend au plus huit publications visibles par auteur; une recherche lexicale avec quelques équivalents français/anglais filtre le sujet, puis le modèle juge leur utilité. Les réponses indiquent les auteurs consultés, ceux restant à consulter, les échecs, dates, liens et limites. Les citations X sont fusionnées aux notes de méthode dans un registre de numéros stable et émises comme événements `sources`; seuls les liens présents dans ces citations sont rendus cliquables dans le texte du chat.

Une publication est une déclaration attribuée et non une confirmation indépendante. La collecte publique est partielle; absence de correspondance ou échec doit être annoncé. Ce raccordement alimente la réponse du coordinateur Assistant; il n’ajoute pas de documents aux archives d’une recherche DEV2 déjà exécutée.

### Liaison authentifiée et couverture

Le client affiche séparément `execution_status` et `coverage`, avec l’horizon daté,
les thèmes couverts/manquants, les sections référencées et les documents réellement
lus. Il récupère jusqu’à deux pages de 150 événements et les preuves du résultat.
Le bouton d’actualisation fonctionne aussi après un état terminal. Les erreurs de
suivi sont bornées par analyse, et le changement de compte annule les requêtes.

Sur AWS, le Bearer Cognito du demandeur est transmis à l’API de recherche dans un
contexte de requête isolé, sans passer dans les arguments du modèle ou dans les
traces. En développement, `RESEARCH_LAMBDA_FUNCTION=investoros-dev-api` sélectionne
une invocation serveur signée IAM. Le serveur doit posséder lambda:InvokeFunction
sur cette fonction; ce mode ne rend pas l’API HTTP publique et ne crée aucun JWT
ni groupe Cognito artificiel. Aucun jeton ou secret n’est stocké dans le catalogue
de skills. Le script dev-profile-api.sh lit cette option depuis le fichier local
ignoré .env.profile-api.

### Aperçus X dans les sources du chat

Les nouvelles citations X transportent `xPost` (texte, date, lien, compteurs et images disponibles) et `xProfile` (auteur, avatar et vérification lus dans le tweet). Ces données restent attachées au message; aucune lecture réseau supplémentaire n’est nécessaire au survol. Les anciennes citations dépourvues de ces champs conservent leur lien de source habituel.

Le composant `TweetSource` est monté seulement lorsque la liste Sources est dépliée. Il affiche une carte `XPostCard` en portail au survol ou au focus, la ferme avec Échap ou au repli, et ouvre le lien direct sur X au clic. La feuille de style du tweet est partagée avec la page Sources. Le frontend AWS a été construit depuis la version déployée avec seulement les composants et types de cette évolution, en conservant Cognito; l’API a reçu uniquement les champs de citation et leur extraction de métadonnées.

Validation finale du 15 novembre 2026 : la demande simple « Analyse NVDA pour la
semaine prochaine » lance bien start_analysis et termine l’analyse
64d778f0-e51b-430f-8277-616bd9d4cc10. Les sept sources collectées et dix intervenants
(agents Bedrock et collecteurs distincts) sont visibles. Le rapport contient cinq
sections, dont les risques conditionnels, les périodes financières exactes et les
horaires distincts de publication/conférence. Tous les critères de couverture sont
remplis, sans prétendre prédire la réaction du cours.

Playwright vérifie les trois onglets, les preuves et documents, la persistance,
l’actualisation après terminaison et l’accès direct en session vierge. À 390×844,
la page ne déborde dans aucune direction et le contenu long défile dans son panneau.
Un scénario de panne simulée vérifie l’arrêt après trois erreurs et la reprise
manuelle. Les images de contrôle ont leurs CRC PNG et leur décodage complet validés.

Le contrôle validation.py rejette les dates de constats d’émetteur absentes des
passages réellement lus, séparément des métadonnées de publication/dépôt. Il
s’applique à la production du résultat et à sa lecture pour les analyses antérieures.
Il s’agit d’un contrôle ciblé, pas d’une preuve générale de justesse sémantique.
Les modules research/ et knowledge/ sont maintenant présents dans ce dépôt et
scripts/build-api.sh refuse un paquet incomplet avant sa publication.

### Activité des outils dans les messages

Les événements `tool` sont affichés dans le message concerné via `ToolActivityFeed`, avec libellé français, paramètres utiles et résultat confirmé. La phase `preparing` commence au signal `contentBlockStart.toolUse` de Bedrock; `executing` indique le début d’exécution serveur. Le frontend garde les heures de réception et marque les opérations non confirmées comme interrompues à la fin ou à l’arrêt du flux. Le transport ferme sa lecture dès `done`/`error`, même si la connexion reste ouverte. La carte de `start_analysis` reprend les événements du run déjà suivis dans `researchRuns`, sans lancer une nouvelle analyse ni ajouter de polling.
