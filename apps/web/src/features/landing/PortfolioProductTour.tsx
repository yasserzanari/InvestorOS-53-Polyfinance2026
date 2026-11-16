import { Database, Newspaper, PieChart, ShieldAlert, Sparkles } from "lucide-react";

const portfolioInsights = [
  {
    icon: PieChart,
    title: "Lire la diversification",
    description: "Comparer les poids par ligne et par catégorie. Dans cet exemple fictif, les trois plus grandes expositions représentent 55 % du total.",
  },
  {
    icon: ShieldAlert,
    title: "Contextualiser les risques avec l’assistant",
    description: "Les cartes calculent la concentration et une sensibilité de ±1 % sur la ligne dominante, les autres positions inchangées. L’IA peut replacer ce calcul dans le profil déclaré, sans score prédictif ni conseil d’achat ou de vente.",
  },
  {
    icon: Database,
    title: "Voir ce qui manque",
    description: "La couverture affiche 5/7 tickers. Sans historique de cours ni composition détaillée, l’écran ne peut pas calculer certains risques ni confirmer les sous-jacents.",
  },
];

export function PortfolioProductTour() {
  return (
    <section id="portefeuille" className="portfolio-story" aria-labelledby="portfolio-story-title">
      <div className="portfolio-story__inner">
        <header className="portfolio-story__intro">
          <h2 id="portfolio-story-title">Comprendre les expositions avant de tirer une conclusion.</h2>
          <p>Une vue d’ensemble relie la répartition, les sensibilités calculées, le profil investisseur et la couverture des données. L’assistant peut ensuite aider à expliquer les signaux et à examiner l’actualité sourcée.</p>
        </header>

        <div className="portfolio-story__layout">
          <figure className="portfolio-story__screen">
            <a href="/landing/portfolio-demo.png" target="_blank" rel="noreferrer" aria-label="Ouvrir la capture du portefeuille en grand format">
              <img src="/landing/portfolio-demo.png" alt="Capture du portefeuille de démonstration : sept expositions, répartition en anneau et quatre repères de risque à examiner." loading="lazy" />
            </a>
            <figcaption>Portefeuille de démonstration · montants, pondérations et profil fictifs · <a href="/landing/portfolio-demo.png" target="_blank" rel="noreferrer">Ouvrir la capture en grand</a></figcaption>
          </figure>

          <div className="portfolio-story__insights">
            {portfolioInsights.map(({ icon: Icon, title, description }) => (
              <article className="portfolio-story__insight" key={title}>
                <span className="portfolio-story__icon"><Icon size={18} aria-hidden="true" /></span>
                <div><h3>{title}</h3><p>{description}</p></div>
              </article>
            ))}
          </div>
        </div>

        <aside id="transparence" className="portfolio-story__news" aria-label="Veille assistée par IA et actualités sourcées">
          <span className="portfolio-story__news-icon"><Sparkles size={19} aria-hidden="true" /></span>
          <div>
            <h3><Newspaper size={16} aria-hidden="true" /> Actualités et analyse assistée par IA</h3>
            <p>Pour les tickers explicitement reliés aux positions, la veille recherche des nouvelles récentes toutes les six heures. L’IA vérifie que l’article parle bien de l’entreprise, repère un extrait justificatif et prépare un résumé avec une prochaine vérification humaine. Les alertes gardent leur source et leur extrait.</p>
            <p className="portfolio-story__limit">La veille reste partielle et peut inclure des sources secondaires : un signal n’établit pas la cause d’une variation, et l’heure d’indexation peut différer de l’heure de publication. Les données de cet écran sont fictives.</p>
            <a href="#analyse">Voir comment l’analyse remonte aux annonces et aux sources →</a>
          </div>
        </aside>
      </div>
    </section>
  );
}
