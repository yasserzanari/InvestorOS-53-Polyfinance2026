import { PieChart } from 'lucide-react';
import type { DemoOverview } from '../../../shared/api';
import { AllocationChart, type AllocationItem } from './AllocationChart';
import { portfolioDisplayLabel } from '../utils/portfolio-label';

const colors = ['#247f78', '#4d6eb3', '#ad7440', '#8b6ab4', '#3984a3', '#b05d69'];

export function AllocationPanel({ portfolio, selected, onSelect }: {
  portfolio: DemoOverview['portfolio'];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const positions: AllocationItem[] = portfolio.positions.map((position, index) => ({
    symbol: position.id,
    name: portfolioDisplayLabel(position.label),
    weight: position.weight_pct,
    value: position.value,
    color: colors[index % colors.length],
  }));

  return (
    <section className="portfolio-panel portfolio-allocation-panel" aria-labelledby="allocation-heading">
      <header className="portfolio-panel-heading">
        <div><span className="portfolio-section-icon"><PieChart size={16} /></span><div><h2 id="allocation-heading">Répartition</h2><p>Poids des positions déclarées</p></div></div>
      </header>
      <AllocationChart positions={positions} total={portfolio.total_value} selected={selected} onSelect={onSelect} />
    </section>
  );
}
