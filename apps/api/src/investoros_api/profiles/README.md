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

`update_profile` updates only allowlisted fields. `upsert_tab` creates or replaces by id. `read_sources` returns verbatim notes from the catalog; the model can reference their stable per-turn `[index]`. `suggest_followups` publishes up to three questions. `run_specialist` performs an actual separate Bedrock call limited to two consultations per turn. There is no browser agent, image capture or invented browser preview. The UI should show the actual specialist result when no browser tool has run.

The orchestrator allows six model rounds and explicitly caps output tokens per call. Configuration, AWS denial, throttling and incomplete responses produce explicit errors. Prompt data and tool outputs are untrusted; all changes are validated server-side and there is no arbitrary network access or code execution.

## Persistence and deployment

The request carries the current demo workspace; this module is stateless. Browser persistence is owned by the frontend. This endpoint does not establish a production user identity or write DynamoDB records. Bind the local development server to loopback and expose it through the frontend development proxy. Production requires an authenticated account context, request rate limits and durable workspace storage.

FastAPI StreamingResponse streams locally. The existing Mangum Lambda/API Gateway adapter may buffer NDJSON responses. Streaming production deployment requires a streaming-capable adapter/transport; the Lambda timeout must also allow multiple model rounds. Do not claim production token streaming simply because this local endpoint streams.
