import { useNavigate } from "react-router-dom";
import { ArrowRight, BookOpenCheck, ChartNoAxesCombined, Compass, LogIn, Network, ShieldCheck } from "lucide-react";
import { appRoutes } from "../../app/routes";
import ResponsiveHeroBanner from "./components/ResponsiveHeroBanner";
import { DropdownNavigation } from "./components/DropdownNavigation";
import { ProfileProductTour } from "./ProfileProductTour";
import { PortfolioProductTour } from "./PortfolioProductTour";
import { AnalysisProductTour } from "./AnalysisProductTour";
import { SupplyChainProductTour } from "./SupplyChainProductTour";
import BeamWordmarkFooter from "./components/BeamWordmarkFooter";
import "./landing.css";

const navItems = [
  {
    id: 1,
    label: "Explorer",
    subMenus: [
      {
        title: "La plateforme",
        items: [
          { label: "Profil investisseur", description: "Projets, contexte et préférences", icon: Compass, href: "#approche" },
          { label: "Portefeuille", description: "Diversification, repères de risque et actualités", icon: ChartNoAxesCombined, href: "#portefeuille" },
          { label: "Exemple d’analyse", description: "Explorer une baisse et ses sources", icon: BookOpenCheck, href: "#analyse" },
          { label: "Chaîne d’approvisionnement", description: "Fournisseurs, rôles et documents associés", icon: Network, href: "#chaine-approvisionnement" },
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
      <div className="landing-hero-wrap relative">
        <header className="landing-header absolute inset-x-0 top-0 z-50 border-b border-white/35 bg-white/35 backdrop-blur-2xl">
          <div className="relative mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-8">
            <a className="inline-flex shrink-0 items-center" href="/" aria-label="InvestorOS, accueil">
              <img src="/brand/investoros-logo.png" className="h-auto w-[104px] object-contain sm:w-[148px]" alt="" />
            </a>
            <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center md:flex" aria-label="Navigation principale">
              <DropdownNavigation navItems={navItems} />
            </nav>
            <div className="flex items-center gap-1 sm:gap-2">
              <button type="button" onClick={() => navigate(appRoutes.login)} aria-label="Connexion" className="inline-flex size-8 items-center justify-center rounded-full text-[#17233d] transition hover:bg-white/35 sm:hidden"><LogIn size={16} aria-hidden="true" /></button>
              <button type="button" onClick={() => navigate(appRoutes.login)} className="hidden rounded-full px-3 py-2 text-sm font-medium text-[#17233d] transition hover:bg-white/35 sm:inline-flex">Connexion</button>
              <button type="button" onClick={() => navigate(appRoutes.dashboard)} className="inline-flex items-center gap-1.5 rounded-full bg-[#101c35]/95 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1e3155] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm">
                Explorer le prototype <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>
        <ResponsiveHeroBanner
          className="investoros-hero"
          onNavigate={navigate}
          logoUrl="/brand/investoros-logo.png"
          backgroundImageUrl=""
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

      <ProfileProductTour />
      <PortfolioProductTour />
      <AnalysisProductTour />
      <SupplyChainProductTour />

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
          { title: "Découvrir", links: [{ label: "Profil investisseur", href: "#approche" }, { label: "Portefeuille", href: "#portefeuille" }, { label: "Exemple d’analyse", href: "#analyse" }, { label: "Chaîne d’approvisionnement", href: "#chaine-approvisionnement" }, { label: "Transparence", href: "#transparence" }] },
          { title: "Accès", links: [{ label: "Connexion", href: appRoutes.login }, { label: "Prototype", href: appRoutes.dashboard }] },
        ]}
        onLinkClick={(_label, href) => { if (href?.startsWith("/")) navigate(href); }}
      />
    </main>
  );
}
