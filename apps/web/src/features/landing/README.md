# InvestorOS public landing page

`LandingPage.tsx` is the public entry page. It routes the main actions with React Router and describes InvestorOS as a hackathon prototype. Its copy does not claim that live market feeds or portfolio simulations are connected.

`ProfileProductTour.tsx` presents the current Profile workspace as a manually controlled slide tour. The five slides match the visible product tabs: Aperçu, Objectifs, Situation, Risque, and Préférences. Their explanations and screenshot paths are in `profile-tour-content.ts`. Screenshots are supplied product captures of the fictional Mateo persona; financial values shown in them are demo data.

The tour offers tab and previous/next controls, announces slide text to assistive technology, and respects reduced-motion preferences. A slide remains in place until the visitor chooses another, so the explanations can be read at their own pace.

`AnalysisProductTour.tsx` follows the profile tour with four views of the supplied NVDA analysis screenshots: the question and chart, an event detail, the research results, and associated sources. Each step explains what the view shows and keeps the distinction between nearby announcements and proven causes explicit. These slides use only the screenshots supplied for the product tours; the hero uses a CSS gradient instead of an illustrative background image.

`PortfolioProductTour.tsx` presents the supplied fictional portfolio screen alongside explanations of allocation, concentration, arithmetic sensitivity, investor-profile inputs, and data coverage. Its news section describes the existing ticker-linked monitoring flow: source-backed, AI-screened cases retain an excerpt and a human follow-up, while partial coverage and the distinction between indexed and publication time remain explicit.

`SupplyChainProductTour.tsx` adds a four-view walkthrough of the supplied NVIDIA supply-chain screenshots: relationship graph, supplier list, documented pressures, and events. The copy clarifies that the relationships do not represent purchase volumes or physical routes, supplier revenue is not NVIDIA procurement, and document interpretations do not prove that a risk occurred.

## FrontUI adaptations

The original snapshots remain unchanged in `/home/yasser/.codex/skills/frontui/components/`.

- `components/ResponsiveHeroBanner.tsx` adapts `responsive-hero-banner`: product copy/assets replace the space demo; demo partners are omitted; the archived internal header is hidden so the shared page header can use DropdownNavigation. It adds a narrow `onNavigate` callback for internal links and a `className` hook for scoped styling. The animation utility classes are defined in `landing.css`.
- `components/DropdownNavigation.tsx` adapts `dorpdown-navigation`. The archived `Props` declared a single item while the component destructures `{ navItems }`; the working copy corrects it to `{ navItems: ...[] }`. Submenu links receive a real `href`, and click/focus can open the menu. The outer `main` element is a `div` because the component is nested inside the page's main landmark.
- `components/GlassLogoReveal.tsx` adapts `liquid-glass-logo-reveal` as `GlassLogoReveal`. The documented narrow wrapper change exposes the product `logo` and accessible `label`. The unavailable `cn` import is replaced by local class concatenation; the inlined WebGL reveal engine and fallback remain intact.
- `components/Features.tsx` follows the six-column, five-card arrangement of the user-provided `landing-features` (`features-8`) source, with local card primitives in `components/Card.tsx`. Demo claims, portrait URLs and filler copy were replaced with prototype context, relationship, limits, scenario and collaboration concepts. The six-column grid, five cards, fingerprint, decorative graph paths, inset frame and connected-profile composition remain. SVG illustrations are hidden from assistive technology and are not measured market data.
- `components/BeamWordmarkFooter.tsx` is copied from the supplied `beam-wordmark-footer` source. The page passes InvestorOS branding, real in-page anchors and `/login` and `/app`; social and credit lists are empty to avoid fictitious accounts or credits.

The project logo is served from `/brand/investoros-logo.png`.
