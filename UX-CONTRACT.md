# InvestorOS UX Contract

## Product context

- **Audience:** datathon users and judges exploring fictional investor personas.
- **Primary jobs:** build a profile, understand a fictional portfolio, and inspect evidence and conditional scenarios.
- **Active locale:** French Canadian (`fr-CA`).
- **Accessibility target:** WCAG 2.2 AA.
- **Data policy:** demo-only fictional information; no brokerage, bank, or real portfolio data.

## Business-context sources

| Domain | Source |
|---|---|
| Investor profile fields and unknowns | `docs/prep/02-comprendre-investisseur.md` |
| Product behavior and account-profile association | `docs/prep/08-plan-fonctions-dashboard.md` |
| Financial calculation and provenance rules | `docs/prep/03-donnees-et-qualite.md` |

## Canonical UI Map

| Capability | Canonical owner | Source | Behavior |
|---|---|---|---|
| Account selector | `DemoAccountContext` + shared `AppShell` select | `apps/web/src/shared/DemoAccountContext.tsx` | Native select; switching account changes the profile context. |
| Form | Feature form with explicit labels and inline feedback | Profile workflow | Draft edit; save locally; confirm as a new demo version. |
| CRUD | Feature route and local demo store | Profile workflow | Edit/save in place; reset restores only the selected fictional example. |
| Feedback | Inline status in the owning screen | Profile workflow | Status remains visible; no browser dialogs or transient-only critical messages. |

## Profile flow

- The active demo account owns one isolated fictional profile. Switching accounts must not merge profile values.
- The conversation and profile sheet represent one draft. Conversation answers update the selected field; all values remain editable in the sheet.
- Saving writes to browser local storage only and displays that limitation. It does not imply an AWS or cross-device save.
- Confirming marks the current local demo version confirmed and increments its version. It does not submit data to an analysis API.
- Unknown fields remain “À préciser”; age must not determine risk capacity.
- Reset affects only the active account's demo profile and immediately restores the included example values.
- Forms have visible labels, preserve values, and use inline status rather than browser alerts.
- Dictation is an optional browser capability; its transcript is editable before submission. Unsupported browsers receive a clear message.

## Data and trust states

Observed data, user-provided demo answers, assumptions, and simulations remain distinguishable. The profile module marks its content as fictional and local to this browser. Do not show fake agent progress or claim Bedrock is connected.

## Verification

- Build and typecheck commands are `npm run build` and `npm run typecheck` from the repository root.
- Keyboard focus is visible on every control; labels remain associated with inputs; narrow layouts stack without clipping.
- Backend, authorization, multi-user persistence, and cross-device synchronization are out of scope until corresponding API contracts and AWS resources exist.

## Profile assistant v2

The profile route now uses a Bedrock-backed streaming conversation with typed tools. Its contract and extension map are in `apps/web/src/features/profiles/ARCHITECTURE.md` and `apps/api/src/investoros_api/profiles/README.md`; these supersede the initial local guided-questionnaire flow above. Profile documents, history and feedback stay local per fictional account. Model calls and specialist consultations are real server-side Bedrock requests. Sources are controlled product method notes actually read by a tool. No web search or browser execution is implied by the expandable specialist result preview.
