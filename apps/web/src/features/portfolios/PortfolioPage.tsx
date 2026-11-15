import { useEffect, useState } from 'react';
import { BriefcaseBusiness, CircleHelp } from 'lucide-react';
import { useDemoAccount } from '../../shared/DemoAccountContext';
import { loadDemoOverview, type DemoApiConnection } from '../../shared/api';
import { AllocationPanel } from './components/AllocationPanel';
import { DemoPortfolioSource } from './components/DemoPortfolioSource';
import { PositionsPanel } from './components/PositionsPanel';
import { RiskMetricsPanel } from './components/RiskMetricsPanel';
import { PortfolioMonitoringPanel } from './components/PortfolioMonitoringPanel';
import './styles/portfolio.css';

export function PortfolioPage() {
  const { activeAccount } = useDemoAccount();
  const [api, setApi] = useState<DemoApiConnection | { status: 'loading' }>({ status: 'loading' });
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setApi({ status: 'loading' });
    setSelectedPosition(null);
    loadDemoOverview(activeAccount.id, controller.signal).then(setApi).catch(() => undefined);
    return () => controller.abort();
  }, [activeAccount.id]);

  const overview = api.status === 'connected' ? api.overview : null;
  const portfolio = overview?.portfolio ?? null;

  return (
    <section className="portfolio-page" aria-label="Portefeuille fictif">
      <header className="portfolio-toolbar">
        <div className="portfolio-heading"><BriefcaseBusiness size={19} /><div><h1>Portefeuille</h1><span>Positions et risques du compte de démonstration</span></div></div>
      </header>

      <DemoPortfolioSource accountName={activeAccount.name} connection={api} />

      <div className="portfolio-dashboard-grid">
        {overview && portfolio ? <>
          <PositionsPanel portfolio={portfolio} selected={selectedPosition} onSelect={setSelectedPosition} />
          <AllocationPanel portfolio={portfolio} selected={selectedPosition} onSelect={setSelectedPosition} />
          <RiskMetricsPanel accountId={overview.persona} accountName={overview.account.display_name} portfolio={portfolio} />
        </> : <section className="portfolio-panel portfolio-empty-state" aria-live="polite">
          {api.status === 'loading' ? <><span className="portfolio-risk-spinner"/><div><strong>Lecture du portefeuille</strong><p>Chargement des positions du compte fictif…</p></div></> : <><CircleHelp size={20}/><div><strong>Positions indisponibles</strong><p>Le portefeuille AWS n’a pas pu être lu. Les données simulées ne sont pas utilisées comme remplacement.</p></div></>}
        </section>}
      </div>
      {portfolio && <PortfolioMonitoringPanel portfolio={portfolio} />}
    </section>
  );
}
