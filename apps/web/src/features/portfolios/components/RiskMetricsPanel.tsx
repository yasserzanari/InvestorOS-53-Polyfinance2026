import { CircleHelp } from 'lucide-react';
import { monthLabels } from '../model/portfolio-model';
import type { PortfolioSnapshot } from '../model/portfolio-model';
import { pct } from '../utils/format';
import { MetricCard } from './MetricCard';

export function RiskMetricsPanel({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const modelReturns = snapshot.monthlyReturns[0]?.values ?? [];
  const bestMonthIndex = modelReturns.reduce<number>((best, value, index, values) => value !== null && value > (values[best] ?? -Infinity) ? index : best, 0);
  const metrics = [
    { label: 'Rendement', value: pct(snapshot.returnPct), note: `QQQ ${pct(snapshot.benchmarkReturn)}`, tone: snapshot.returnPct >= 0 ? 'positive' as const : 'negative' as const },
    { label: 'Volatilité', value: `${snapshot.metrics.volatility.toFixed(1)} %`, note: 'Annualisée · modèle' },
    { label: 'Sharpe', value: snapshot.metrics.sharpe.toFixed(2), note: 'Taux de référence 2 %' },
    { label: 'Repli maximal', value: pct(snapshot.metrics.maxDrawdown), note: 'Depuis le dernier sommet', tone: 'negative' as const },
    { label: 'Bêta au QQQ', value: snapshot.metrics.beta.toFixed(2), note: 'Sensibilité au repère' },
    { label: 'Meilleur mois', value: pct(snapshot.bestMonth), note: monthLabels[bestMonthIndex] ?? 'Mois observé', tone: 'positive' as const },
  ];

  return (
    <section className="portfolio-panel portfolio-risk-panel" aria-labelledby="risk-heading">
      <header className="portfolio-panel-heading"><div><h2 id="risk-heading">Risque et rendement</h2><p>{snapshot.step} séances · comparaison indicative</p></div><CircleHelp size={16} aria-hidden="true" /></header>
      <div className="portfolio-metrics-grid">{metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</div>
    </section>
  );
}
