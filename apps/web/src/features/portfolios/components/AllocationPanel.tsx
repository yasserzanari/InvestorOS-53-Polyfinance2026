import { AllocationChart } from './AllocationChart';
import type { PortfolioPosition } from '../model/portfolio-model';
import { shortDate } from '../utils/format';

type AllocationPanelProps = {
  positions: PortfolioPosition[];
  total: number;
  date: string;
  selected: string | null;
  onSelect: (symbol: string) => void;
};

export function AllocationPanel({ positions, total, date, selected, onSelect }: AllocationPanelProps) {
  return (
    <section className="portfolio-panel portfolio-allocation-panel" aria-labelledby="allocation-heading">
      <header className="portfolio-panel-heading"><div><h2 id="allocation-heading">Allocation</h2><p>Poids actuel et cibles du modèle</p></div><time dateTime={date}>{shortDate(date)}</time></header>
      <AllocationChart positions={positions} total={total} selected={selected} onSelect={onSelect} />
    </section>
  );
}
