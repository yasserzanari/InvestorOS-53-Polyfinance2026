import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDownRight, ArrowRight, BookOpenCheck, ChartNoAxesCombined, Compass, ShieldCheck } from "lucide-react";
import { appRoutes } from "../../app/routes";
import ResponsiveHeroBanner from "./components/ResponsiveHeroBanner";
import { DropdownNavigation } from "./components/DropdownNavigation";
import { Features } from "./components/Features";
import BeamWordmarkFooter from "./components/BeamWordmarkFooter";
import "./landing.css";

const GlassReveal21st = lazy(() => import("./components/GlassReveal21st").then((module) => ({ default: module.GlassReveal21st })));

const navItems = [
  {
    id: 1,
    label: "Explorer",
    subMenus: [
      {
        title: "La plateforme",
        items: [
          { label: "Notre approche", description: "Profil, contexte et hypothèses", icon: Compass, href: "#approche" },
          { label: "Transparence", description: "Sources, limites et vérifications", icon: BookOpenCheck, href: "#transparence" },
        ],
      },
      {
        title: "Accès",
        items: [
          { label: "Ouvrir l’espace", description: "Découvrir le prototype InvestorOS", icon: ChartNoAxesCombined, href: appRoutes.dashboard },
          { label: "Se connecter", description: "Accéder à votre espace", icon: ShieldCheck, href: appRoutes.login },
        ],
      },
    ],
  },
];

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <main className="investor-landing min-h-screen bg-white text-slate-950">
      <header className="landing-header sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="relative mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <a className="inline-flex h-12 w-36 items-center" href="/" aria-label="InvestorOS, accueil">
            <Suspense fallback={<img src="/brand/investoros-logo.png" className="h-10 w-full object-contain" alt="InvestorOS" />}>
              <GlassReveal21st logo="/brand/investoros-logo.png" label="InvestorOS" tileSize={256} logoScale={0.54} finalScale={0.84} loop={false} className="size-full" />
            </Suspense>
          </a>
          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center md:flex" aria-label="Navigation principale">
            <DropdownNavigation navItems={navItems} />
          </nav>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => navigate(appRoutes.login)} className="hidden rounded-full px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:inline-flex">Connexion</button>
            <button type="button" onClick={() => navigate(appRoutes.dashboard)} className="inline-flex items-center gap-2 rounded-full bg-[#101c35] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1e3155] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
              Explorer le prototype <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
        <nav className="flex items-center justify-center gap-6 border-t border-slate-100 px-4 py-2.5 text-xs font-medium text-slate-600 md:hidden" aria-label="Navigation mobile">
          <a href="#approche" className="hover:text-cyan-800">Approche</a>
          <a href="#transparence" className="hover:text-cyan-800">Transparence</a>
          <button type="button" onClick={() => navigate(appRoutes.login)} className="hover:text-cyan-800">Connexion</button>
        </nav>
      </header>

      <div className="landing-hero-wrap relative">
        <ResponsiveHeroBanner
          className="investoros-hero"
          onNavigate={navigate}
          logoUrl="/brand/investoros-logo.png"
          backgroundImageUrl="/landing/hero-future-landscape.png"
          navLinks={[]}
          ctaButtonText="Connexion"
          ctaButtonHref={appRoutes.login}
          badgeLabel=""
          badgeText=""
          title="Investir avec plus"
          titleLine2="de contexte et de clarté."
          description="Un prototype pour relier le profil investisseur, l’analyse de portefeuille et des scénarios de marché — en gardant les hypothèses et les limites visibles."
          primaryButtonText="Explorer le prototype"
          primaryButtonHref={appRoutes.dashboard}
          secondaryButtonText="Voir notre approche"
          secondaryButtonHref="#approche"
          partnersTitle="Une lecture structurée, de vos objectifs jusqu’aux facteurs de risque"
          partners={[]}
        />
      </div>

      <section id="approche" className="relative overflow-hidden border-b border-slate-100 bg-white py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:items-end">
          <div>
            <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-.035em] text-[#101c35] sm:text-4xl">Une décision commence par votre contexte.</h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-slate-600">InvestorOS explore une façon plus claire de préparer une décision d’investissement : préciser ce qui compte pour vous, examiner les expositions, puis comparer des trajectoires possibles sans masquer l’incertitude.</p>
        </div>
      </section>

      <section className="bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <div className="mb-10 max-w-2xl">
            <h2 className="mt-3 text-3xl font-semibold tracking-[-.035em] text-[#101c35] sm:text-4xl">Comprendre les liens avant de choisir une direction.</h2>
            <p className="mt-4 leading-7 text-slate-600">Les cartes ci-dessous décrivent l’approche produit visée pour le hackathon. Elles ne représentent pas des résultats de marché mesurés.</p>
          </div>
        </div>
        <Features />
      </section>

      <section id="transparence" className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <h2 className="mt-3 max-w-md text-3xl font-semibold tracking-[-.035em] text-[#101c35] sm:text-4xl">Une explication utile montre aussi ce qu’elle ignore.</h2>
              <p className="mt-4 max-w-lg leading-7 text-slate-600">Les prévisions et scénarios sont des explorations conditionnelles, pas des certitudes. Les données, leur date, leur provenance et les hypothèses doivent pouvoir être vérifiées avant toute décision.</p>
              <a href={appRoutes.dashboard} onClick={(event) => { event.preventDefault(); navigate(appRoutes.dashboard); }} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-800 hover:text-cyan-950">Voir l’espace de travail <ArrowDownRight size={16} aria-hidden="true" /></a>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Prototype de hackathon", "Une interface en construction, destinée à explorer des parcours d’analyse."],
                ["Scénarios conditionnels", "Une trajectoire dépend d’hypothèses explicites et peut diverger du réel."],
                ["Sources à examiner", "La qualité, la fraîcheur et la couverture des données influencent toute conclusion."],
                ["Décision humaine", "InvestorOS sert à éclairer une réflexion, pas à remplacer votre jugement."],
              ].map(([title, description]) => (
                <article key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
                  <div className="mb-5 flex size-9 items-center justify-center rounded-xl bg-white text-cyan-800 shadow-sm"><ShieldCheck size={18} aria-hidden="true" /></div>
                  <h3 className="font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f1f7f9] py-16 sm:py-20">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-7 px-5 sm:px-8 md:flex-row md:items-center">
          <div>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-.035em] text-[#101c35]">Préparez votre prochaine décision avec plus de recul.</h2>
          </div>
          <button type="button" onClick={() => navigate(appRoutes.login)} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#101c35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1e3155]">Entrer dans InvestorOS <ArrowRight size={16} aria-hidden="true" /></button>
        </div>
      </section>

      <BeamWordmarkFooter
        brand="InvestorOS"
        wordmark="INVESTOROS"
        company="InvestorOS · Polyfinance 2026"
        year={2026}
        socials={[]}
        credits={[]}
        animate={false}
        background="#0c1528"
        ink="#e7edf8"
        muted="#8290a8"
        accent="#63d5e6"
        wordTop="#202e49"
        wordFoot="#101c35"
        columns={[
          { title: "Découvrir", links: [{ label: "Approche", href: "#approche" }, { label: "Transparence", href: "#transparence" }] },
          { title: "Accès", links: [{ label: "Connexion", href: appRoutes.login }, { label: "Prototype", href: appRoutes.dashboard }] },
        ]}
        onLinkClick={(_label, href) => { if (href?.startsWith("/")) navigate(href); }}
      />
    </main>
  );
}
