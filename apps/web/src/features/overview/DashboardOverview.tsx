import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, BookOpenCheck, BriefcaseBusiness, ChartNoAxesCombined, Layers3, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { productModules } from '../../app/modules';
import { demoAccounts } from '../../shared/DemoAccountContext';
import { loadSimulationNews, type DemoApiConnection, type SimulationNewsArticle } from '../../shared/api';
import { DashboardActivityFeed } from './components/DashboardActivityFeed';
import { PortfolioDiversificationMap } from './components/PortfolioDiversificationMap';

function linkedTickers(api: DemoApiConnection): string[] {
  if (api.status !== 'connected') return [];
  return [...new Set(api.overview.portfolio.positions.flatMap(({ ticker }) =>
    typeof ticker === 'string' && /^[A-Z0-9.]{1,12}$/i.test(ticker.trim()) ? [ticker.trim().toUpperCase()] : [],
  ))].slice(0, 5);
}

export function DashboardOverview({ api, onStartChat, children }: { api: DemoApiConnection; onStartChat: (question: string) => void; children: ReactNode }) {
  const modules = productModules.filter(({ id }) => id !== 'overview');
  const connected = api.status === 'connected';
  const tickers = useMemo(() => linkedTickers(api), [api]);
  const tickerKey = tickers.join(',');
  const [marketNews, setMarketNews] = useState<Array<SimulationNewsArticle & { ticker: string }>>([]);
  const [newsStatus, setNewsStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');

  useEffect(() => {
    if (!connected) {
      setMarketNews([]);
      setNewsStatus('idle');
      return;
    }
    if (!tickerKey) {
      setMarketNews([]);
      setNewsStatus('ready');
      return;
    }

    const controller = new AbortController();
    const activeTickers = tickerKey.split(',');
    setNewsStatus('loading');
    Promise.all(activeTickers.map(async (ticker) => {
      try {
        return { ticker, result: await loadSimulationNews(ticker, controller.signal) };
      } catch {
        return { ticker, result: null };
      }
    })).then((results) => {
      if (controller.signal.aborted) return;
      const available = results.filter((item) => item.result?.available);
      const articles = available.flatMap(({ ticker, result }) => (result?.articles ?? []).map((article) => ({ ...article, ticker })));
      const unique = [...new Map(articles.map((article) => [article.url, article])).values()]
        .sort((left, right) => Date.parse(right.indexedAt) - Date.parse(left.indexedAt));
      setMarketNews(unique.slice(0, 8));
      setNewsStatus(results.every((item) => item.result === null) ? 'unavailable' : 'ready');
    });
    return () => controller.abort();
  }, [connected, tickerKey]);

  const currency = connected ? api.overview.portfolio.currency : 'CAD';
  const portfolioValue = connected
    ? new Intl.NumberFormat('fr-CA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(api.overview.portfolio.total_value)
    : 'À connecter';
  const profileValue = connected
    ? api.overview.profile.status === 'confirmed' ? 'Confirmé' : 'À revoir'
    : api.status === 'not_configured' ? 'À compléter' : 'Indisponible';
  const statusCards = [
    { label: 'Portefeuille', value: portfolioValue, note: connected ? `${api.overview.portfolio.positions.length} positions · données fictives AWS` : 'Ajoutez vos positions', Icon: BriefcaseBusiness, href: '/app/portfolios', tone: 'blue' },
    { label: 'Profil investisseur', value: profileValue, note: connected ? api.overview.profile.display_name : 'Définissez vos objectifs', Icon: UsersRound, href: '/app/profiles', tone: 'teal' },
    { label: 'Analyses', value: connected ? String(api.overview.analyses.length) : 'Aucune', note: connected ? 'Analyses enregistrées dans la démo' : 'Les résultats seront ici', Icon: ChartNoAxesCombined, href: '/app/analyses', tone: 'violet' },
    { label: 'Sources et méthode', value: 'Consulter', note: 'Provenance, disponibilité et limites', Icon: BookOpenCheck, href: '/app/evidence', tone: 'amber' },
  ];

  const apiMessage = api.status === 'connected'
    ? `API AWS connectée · ${api.overview.account.display_name} · source DynamoDB fictive`
    : api.status === 'rate_limited'
      ? 'API temporairement limitée (429). Réessayez dans quelques instants.'
      : api.status === 'unavailable'
        ? 'API AWS indisponible; les modules affichés restent en mode démonstration.'
        : 'Mode démonstration · API AWS non configurée pour cet environnement.';

  return (
    <section className="dashboard-overview-view" aria-label="Vue d’ensemble InvestorOS">
      <header className="dashboard-heading">
        <div>
          <h1>Votre espace de décision</h1>
          <p>Un aperçu clair des données disponibles et des prochaines étapes.</p>
          <p className="dashboard-api-notice" role="status" aria-live="polite">{apiMessage}</p>
        </div>
        <Link className="dashboard-primary-action" to="/app/profiles"><UsersRound size={16} /> Créer un profil <ArrowRight size={15} /></Link>
      </header>

      <section className="dashboard-status-grid" aria-label="État de votre espace">
        {statusCards.map(({ label, value, note, Icon, href, tone }) => (
          <Link className={`dashboard-status-card tone-${tone}`} to={href} key={label}>
            <span className="dashboard-status-icon"><Icon size={19} aria-hidden="true" /></span>
            <span className="dashboard-status-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></span>
            <ArrowRight className="dashboard-status-arrow" size={15} aria-hidden="true" />
          </Link>
        ))}
      </section>

      <div className="dashboard-overview-grid">
        <div className="dashboard-main-column">
          <div className="dashboard-prompt-center">{children}</div>
          <DashboardActivityFeed api={api} news={marketNews} newsStatus={newsStatus} hasLinkedTickers={tickers.length > 0} />
          <section className="dashboard-panel platform-stats-panel" aria-labelledby="platform-stats-title">
            <div className="dashboard-panel-heading">
              <div><h2 id="platform-stats-title">InvestorOS en bref</h2><p>Les ressources de cet environnement de démonstration.</p></div>
              <ChartNoAxesCombined size={18} className="platform-stats-icon" aria-hidden="true" />
            </div>
            <div className="platform-stats-grid">
              <div><strong>{modules.length}</strong><span>espaces de travail</span></div>
              <div><strong>{demoAccounts.length}</strong><span>profils démo</span></div>
              <div><strong>{connected ? 'Connectée' : api.status === 'not_configured' ? 'À relier' : 'Indisponible'}</strong><span>API du compte</span></div>
            </div>
            <p className="platform-stats-note">Les profils et portefeuilles affichés sont fictifs; les nouvelles de marché ne sont associées qu’aux tickers explicitement présents dans les positions.</p>
          </section>
        </div>

        <div className="dashboard-side-column">
          <section className="dashboard-panel portfolio-state-panel" aria-labelledby="portfolio-state-title">
            <div className="dashboard-panel-heading">
              <div><h2 id="portfolio-state-title">Diversification du portefeuille</h2><p>{connected ? `${api.overview.portfolio.display_name} · ${portfolioValue}` : 'Répartition des positions et poids relatifs'}</p></div>
              <span className="portfolio-state-icon"><Layers3 size={18} /></span>
            </div>
            <PortfolioDiversificationMap portfolio={connected ? api.overview.portfolio : undefined} />
          </section>

        </div>
      </div>
    </section>
  );
}
