---
version: alpha
name: InvestorOS
description: A French-first investor workspace for understanding fictional portfolios through traceable evidence and clear trade-offs.
colors:
  canvas: "#F4F7FB"
  surface: "#FFFFFF"
  ink: "#16243B"
  muted: "#69778E"
  brand: "#356CE0"
  teal: "#16A6B5"
  line: "#DCE4EE"
  caution: "#B88736"
  success: "#318769"
typography:
  sans:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    lineHeight: "1.5"
  mono:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
rounded:
  DEFAULT: "0.75rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
spacing:
  content-gutter: "clamp(18px, 3vw, 42px)"
  page-max: "90rem"
components:
  button: { }
  card: { }
  field: { }
  navigation: { }
---

# InvestorOS Design System

## Overview

### Creative North Star

The product workspace should feel like a calm financial research desk: paper-white surfaces, slate-blue structure, compact labels, and teal used for evidence or saved-state cues. The dashboard now carries a warm, slowly drifting mesh behind restrained glass surfaces; navigation and data panels stay legible and operational rather than promotional.

### Product context and register

- **Audience and primary job:** datathon judges and users exploring fictional investor profiles and portfolios; understand how a decision relates to goals, risk, and evidence.
- **Target market(s) and evidence:** Canadian datathon context; use CAD and French Canadian wording where relevant.
- **Locale(s) and language policy:** French-first (`fr-CA`) UI; use `Intl` with `fr-CA` for dates and numbers.
- **Usage scene:** desktop workspace with a persistent sidebar, plus responsive single-column flows on narrow screens.
- **Register:** product interface; landing page may carry more visual expression.
- **Memorable signature:** the live profile sheet paired with a guided conversation, so every response has an editable home.
- **Restraint:** no invented live-data states, opaque risk scores, decorative agent activity, or false confidence.
- **Token ownership/runtime mapping:** this file records the existing runtime palette; `apps/web/src/styles/tokens.css` and `global.css` remain the CSS implementation source. Feature styles should reuse their palette and derive local variants from it.

## Colors

The canvas `#F4F7FB` separates the workspace from white cards. Ink `#16243B` carries primary text, muted `#69778E` carries secondary labels, and line `#DCE4EE` defines quiet edges. Brand blue `#356CE0` is reserved for primary actions and focus; teal `#16A6B5` marks guidance and contextual emphasis. Caution `#B88736` and success `#318769` always appear with text or icons, never as color-only meaning. The dashboard's ambient mesh uses `#FAFAFA`, `#F7D797`, and `#F7C097`; runtime values live in `apps/web/src/styles/tokens.css` and are read by `apps/web/src/shared/MeshDriftBackground.tsx`.

## Typography

Inter and its system fallbacks serve headings, body copy, and labels. Dense financial values use tabular numerals when possible. French copy uses sentence case, short labels, and visible units/currencies.

## Layout

The shared shell keeps its 76px collapsed sidebar and 62px top bar. Product pages use a fluid content width, compact card grids, and `clamp(18px, 3vw, 42px)` gutters. The dashboard groups its prompt and notifications in the left column, with portfolio exposure and platform status in the right column. Profile work fills the viewport below the shared shell with two adjacent panels, no outer gutters. Chat and AI-managed documents scroll independently; the composer, tabs and bottom actions remain visible. Narrow layouts stack the panels.

## Elevation & Depth

Hierarchy comes from hairline borders, restrained shadows, and selective backdrop blur. The shared shell and dashboard cards use translucent white over the warm ambient mesh; inner charts and text retain clear contrast. The WebGL background is mounted behind page content, caps device pixel ratio at 2, pauses when the tab is hidden, and becomes a still frame when reduced motion is requested.

## Shapes

Fields and cards use 9–16px radii based on size. Focus is a visible blue outline. Icons use Lucide with consistent 14–18px strokes and retain text labels for primary actions.

## Components

Buttons use a clear primary blue action and quiet outlined secondary actions. Form values have visible labels and preserve input after local errors. Saved, draft, confirmed, unknown, and simulated states have text labels. Motion is brief and respects reduced-motion preferences. Charts and values must identify period, currency, source, and whether they are simulated.

## Do's and Don'ts

- **Do:** keep the active account visible and bind its profile to it.
- **Do:** make unknowns and demo-only behavior explicit.
- **Don't:** imply Bedrock, persistence, or live financial data is connected when it is not.
- **Don't:** use one score or color to imply a universal level of investment suitability.
