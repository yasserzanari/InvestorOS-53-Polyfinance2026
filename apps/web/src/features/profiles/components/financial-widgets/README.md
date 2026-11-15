# Financial widgets

Inline portfolio visualizations for assistant messages. The parent chat owns event parsing, active-account matching, and widget lifecycle; this module accepts only a `FinancialWidgetData` payload and never fetches or invents financial data.

## Entry points

- `FinancialWidget({ widget, onPeriodChange })` renders the selected portfolio, heatmap, allocation, contributions, or sectors view.
- `parseFinancialWidget(value)` validates server events and persisted values before rendering.
- `FinancialWidgetData` is the shared TypeScript contract. Each payload includes all four period snapshots; period controls only change the local view.

The caller must verify that `widget.persona` belongs to the active account before mounting. Do not render arbitrary cached JSON without calling the parser.

## Data rules

- Current positions and allocation use only the portfolio values and explicit sector associations in the payload.
- Historical portfolio lines require the supplied valuation points. The dashed reference is the first observed value in the selected period and is not labeled as acquisition cost.
- Missing history remains `null`/“Indisponible”; it is never formatted as a zero return.
- Adjusted ticker price changes can support percentage movement only. They are excluded from monetary contribution bars. Monetary contribution requires attributed portfolio valuation data.
- Heatmap tile area reflects the supplied current position value. If period movement is unavailable, tiles remain visible in a neutral color.
- Sector charts show only sectors explicitly supplied by the backend. Unknown sector membership is not inferred.
- Source, classification, method, and limitations remain visible in the expandable provenance disclosure.

## Visual source notes

The presentation follows the approved portfolio, position heatmap, allocation, and contribution references in the task brief. The `chart/recharts-chart-kit.tsx` support file is an app-local snapshot of the archived `components/data-visualization/charts/recharts-chart-kit` implementation, with its utility import redirected to the app's existing `cn` helper. Its tooltip, accessibility table, keyboard layer, and responsive container are preserved. The position heatmap uses the archived `components/analysis-markets/heatmap` deterministic squarify geometry and interaction model, adapted to require prop data and to render unavailable movement neutrally. The heatmap adds explicit height/metric props, stronger gain/loss colors and larger labels to follow the user-approved ImageGen reference; its squarify and keyboard/pinning engines remain the archived implementation. Inline chart heights fit the chat viewport, with full inspection in the dialog.

No sample portfolio rows or default chart fixtures are bundled in this module. The financial values presented by this component always come from its caller's validated payload.

Period changes call the host callback so the conversation persists its selected period and can pass enum-only presentation context back to the agent. Display-only narration comes from the server calculation, which prevents a free-text summary from reversing a sector direction. The normal configured portfolios keep missing history visible; the separate local preview script supplies an explicitly named illustrative model from the authorized AlphaForge pack.

## Compact conversation layout

Inline cards follow the normal 680px conversation column. The dedicated `financial-widgets-inline.css` variant keeps summary typography readable, shortens chart heights and removes repeated internal headings. Portfolio previews show three position shares and open the complete interactive table with “Voir les positions”. Allocation amounts remain available by selecting a row or expanding the card. The sibling dialog keeps the detailed chart/table layout; inline density rules do not apply to it. Follow-up questions are collapsed by default in widget messages.
