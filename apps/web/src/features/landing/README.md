# InvestorOS public landing page

`LandingPage.tsx` is the public entry page. It routes the main actions with React Router and describes InvestorOS as a hackathon prototype. Its copy does not claim that AWS, Bedrock, live market feeds, or portfolio simulations are connected.

## FrontUI adaptations

The original snapshots remain unchanged in `/home/yasser/.codex/skills/frontui/components/`.

- `components/ResponsiveHeroBanner.tsx` adapts `responsive-hero-banner`: product copy/assets replace the space demo; demo partners are omitted; the archived internal header is hidden so the shared page header can use DropdownNavigation. It adds a narrow `onNavigate` callback for internal links and a `className` hook for scoped styling. The animation utility classes are defined in `landing.css`.
- `components/DropdownNavigation.tsx` adapts `dorpdown-navigation`. The archived `Props` declared a single item while the component destructures `{ navItems }`; the working copy corrects it to `{ navItems: ...[] }`. Submenu links receive a real `href`, and click/focus can open the menu. The outer `main` element is a `div` because the component is nested inside the page's main landmark.
- `components/GlassReveal21st.tsx` adapts `liquid-glass-logo-reveal` as `GlassReveal21st`. The documented narrow wrapper change exposes the product `logo` and accessible `label`. The unavailable `cn` import is replaced by local class concatenation; the inlined WebGL reveal engine and fallback remain intact.
- `components/Features.tsx` follows the six-column, five-card arrangement of the user-provided `landing-features` (`features-8`) source, with local card primitives in `components/Card.tsx`. Demo claims, portrait URLs and filler copy were replaced with prototype context, relationship, limits, scenario and collaboration concepts. The six-column grid, five cards, fingerprint, decorative graph paths, inset frame and connected-profile composition remain. SVG illustrations are hidden from assistive technology and are not measured market data.
- `components/BeamWordmarkFooter.tsx` is copied from the supplied `beam-wordmark-footer` source. The page passes InvestorOS branding, real in-page anchors and `/login` and `/app`; social and credit lists are empty to avoid fictitious accounts or credits.

The generated visual `public/landing/hero-future-landscape.png` is used as the hero backdrop. The project logo is served from `/brand/investoros-logo.png`.
