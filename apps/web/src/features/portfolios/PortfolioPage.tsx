import { useEffect, useState } from 'react';
import { useDemoAccount } from '../../shared/DemoAccountContext';
import { loadDemoOverview, type DemoApiConnection } from '../../shared/api';
import { AllocationPanel } from './components/AllocationPanel';
import { DemoPortfolioSource } from './components/DemoPortfolioSource';
import { MonthlyReturnsPanel } from './components/MonthlyReturnsPanel';
import { PortfolioChartPanel } from './components/PortfolioChartPanel';
import { PortfolioToolbar } from './components/PortfolioToolbar';
import { PositionsPanel } from './components/PositionsPanel';
import { RiskMetricsPanel } from './components/RiskMetricsPanel';
import { usePortfolioReplay } from './hooks/usePortfolioReplay';
import './styles/portfolio.css';

export function PortfolioPage() {
  const { activeAccount } = useDemoAccount();
  const replay = usePortfolioReplay(activeAccount.name);
  const [api, setApi] = useState<DemoApiConnection | { status: 'loading' }>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setApi({ status: 'loading' });
    loadDemoOverview(activeAccount.id, controller.signal).then(setApi).catch(() => undefined);
    return () => controller.abort();
  }, [activeAccount.id]);

  function toggleRebalancePreview() {
    replay.setPreviewingRebalance((current) => !current);
    replay.pausePlayback();
  }

  return (
    <section className="portfolio-page" aria-label="Portefeuille modèle">
      <PortfolioToolbar
        snapshot={replay.snapshot}
        speed={replay.speed}
        isPlaying={replay.isPlaying}
        exportComplete={replay.exportComplete}
        onSpeedChange={replay.setSpeed}
        onTogglePlayback={replay.togglePlayback}
        onReset={replay.resetReplay}
        onExport={replay.exportCurrentSnapshot}
      />

      <DemoPortfolioSource accountName={activeAccount.name} connection={api} />

      <div className="portfolio-dashboard-grid">
        <PortfolioChartPanel snapshot={replay.snapshot} />
        <AllocationPanel
          positions={replay.snapshot.positions}
          total={replay.snapshot.total}
          date={replay.snapshot.date}
          selected={replay.selectedSymbol}
          onSelect={replay.setSelectedSymbol}
        />
        <MonthlyReturnsPanel rows={replay.snapshot.monthlyReturns} selected={replay.selectedSymbol} onSelect={replay.setSelectedSymbol} />
        <RiskMetricsPanel snapshot={replay.snapshot} />
        <PositionsPanel
          snapshot={replay.snapshot}
          positions={replay.snapshot.positions}
          selectedSymbol={replay.selectedSymbol}
          selectedPosition={replay.selectedPosition}
          preview={replay.rebalancePreview}
          onApplyRebalance={replay.applyManualRebalance}
          previewingRebalance={replay.previewingRebalance}
          onSelect={replay.setSelectedSymbol}
          onToggleRebalance={toggleRebalancePreview}
        />
      </div>
    </section>
  );
}
