import { useMemo } from 'react';
import PortfolioChart from '../charts/portfolio-chart/PortfolioChart';
import { INITIAL_CAPITAL, type PortfolioSnapshot } from '../model/portfolio-model';
import { pct, portfolioPeriods, usd } from '../utils/format';

export function PortfolioChartPanel({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const data = useMemo(() => snapshot.points.slice(-253).map((point) => ({
    t: Date.parse(point.date),
    value: point.value,
    basis: INITIAL_CAPITAL,
  })), [snapshot.points]);

  return (
    <section className="portfolio-panel portfolio-chart-panel" aria-label="Historique simulé du portefeuille">
      <p className="portfolio-chart-caption">Capital initial {usd(INITIAL_CAPITAL)} · QQQ {pct(snapshot.benchmarkReturn)} · {snapshot.rebalances.length} rééquilibrages simulés</p>
      <PortfolioChart data={data} label="Valeur du portefeuille" defaultRange="1A" showDrawdown height={300} ranges={portfolioPeriods} />
    </section>
  );
}
