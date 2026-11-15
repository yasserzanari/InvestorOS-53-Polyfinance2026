import { BriefcaseBusiness } from 'lucide-react';
import type { DemoOverview } from '../../../shared/api';

const colors = ['#247f78', '#4d6eb3', '#ad7440', '#8b6ab4', '#3984a3', '#b05d69'];

function money(value: number, currency: string) {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

export function PositionsPanel({ portfolio, selected, onSelect }: {
  portfolio: DemoOverview['portfolio'];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <section className="portfolio-panel portfolio-positions-panel" aria-labelledby="positions-heading">
      <header className="portfolio-panel-heading">
        <div><span className="portfolio-section-icon"><BriefcaseBusiness size={16} /></span><div><h2 id="positions-heading">Positions</h2><p>{portfolio.positions.length} lignes · valeurs de la fixture du compte</p></div></div>
        <strong className="portfolio-total-value">{money(portfolio.total_value, portfolio.currency)}</strong>
      </header>
      <div className="portfolio-position-list" aria-label="Positions du portefeuille fictif">
        {portfolio.positions.map((position, index) => {
          const color = colors[index % colors.length];
          return <button className={`portfolio-position-row${selected === position.id ? ' is-selected' : ''}`} type="button" key={position.id} aria-pressed={selected === position.id} onClick={() => onSelect(selected === position.id ? null : position.id)}>
            <span className="portfolio-position-identity"><i style={{ background: color }} /><span><strong>{position.label}</strong>{position.ticker && <small>{position.ticker}</small>}</span></span>
            <span className="portfolio-position-weight"><span>{position.weight_pct.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} %</span><i><b style={{ width: `${Math.max(0, Math.min(100, position.weight_pct))}%`, background: color }} /></i></span>
            <strong className="portfolio-position-value">{money(position.value, portfolio.currency)}</strong>
          </button>;
        })}
      </div>
      <p className="portfolio-panel-footnote">Montants et pondérations lus depuis le portefeuille fictif configuré. Aucun historique de cours n’est fourni ici.</p>
    </section>
  );
}
