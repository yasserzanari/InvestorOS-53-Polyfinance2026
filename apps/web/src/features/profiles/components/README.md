# Profile chat UI components

- `ai-agent-response.tsx`: exact user-provided FrontUI archive source, with only the `cn` import mapped to the project's helper. Original animation/rail/trace presentation retained. `LiveActivity` sets `autoPlay=false`: backend status/tool events are real; no demo reasoning scripts are run.
- `message-actions.tsx`: exact archived user-provided source, unchanged. Host owns actual regeneration, feedback persistence, and voice callbacks. Clipboard availability depends on browser secure context; host should provide a fallback in HTTP LAN contexts.
- `StreamingAnswer`: controlled adaptation of the supplied streaming-text reference. Text arrives from the API; numeric references resolve only against returned HTTP(S) source records. Source links open separately, source lists expand, follow-up buttons call the host callback. There are no fictional source fixtures.
- `MessageScroller`: adaptation of the supplied minimap reference with a rich `renderMessage` slot. The viewport scrolls independently and only follows new content while the reader stays near the bottom. The minimap appears after two user messages; clicking a marker centers its actual message.
- `PromptBar`: adaptation of the supplied prompt-input pattern, using the existing light application theme and actual SpeechRecognition where available. It keeps stop/send distinct, handles IME Enter, stores the recognition instance, stops it on unmount and shows a real elapsed dictation timer. No synthetic voice message is sent. Microphone permission typically requires HTTPS on a LAN address.

These wrappers use existing React/Lucide/Tailwind utilities; no additional package is required. The page owns request cancellation, message versions, backend activity adaptation, and workspace updates. No component invokes AWS directly or receives AWS credentials.

## Exact registry snapshots added for the requested references

The following full sources match the components pasted by the user. Source internals are retained; only the `cn` import maps to the project helper. No demo playback code is included.

| File | Registry source | Runtime dependency |
| --- | --- | --- |
| `subagent.tsx` | Author: aadixc0de / subagent — id 45574 | `@base-ui/react/collapsible` |
| `research-progress.tsx` | Author: aadixc0de / research-progress — id 45508 | `@base-ui/react/collapsible` |
| `thinking-pill.tsx` | https://studios.lou15.com/ — id 42983 | React + WebGL with its CSS fallback |
| `tool-browser.tsx` | Author: aadixc0de / tool-browser — id 45524 | `@base-ui/react/collapsible`, `@base-ui/react/dialog` |

Host integration must pass real run status, timing, tool counts, plans and activity. A `ToolBrowser` screenshot is only displayed when a runtime supplies an actual valid capture or a clearly identified document preview. These views never execute browser actions, create agents, or invoke Bedrock by themselves.

Narrow integration exception: `ToolBrowser` exposes an optional `title` prop to
label real specialist document previews as “Aperçu du résultat”. This changes
only the header text; source layout, frame, zoom and interaction remain intact.
The component is therefore a documented project copy, not a pristine snapshot.

`AskUserCard` : formulaire contrôlé par l’événement `questions` de l’outil
`ask_user`. Choix unique, choix multiples ou réponse développée; aucune sélection
initiale, brouillon local, champs requis, option « Autre », étapes numérotées et
résumé après envoi. Le contrat est partagé dans `../question-model.ts`.
