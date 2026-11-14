import type { MonthlyReturnRow } from '../model/portfolio-model';
import { monthLabels } from '../model/portfolio-model';
import { pct } from '../utils/format';

function ReturnCell({ value }: { value: number | null }) {
  if (value === null) return <span className="return-cell is-empty">—</span>;
  const alpha = Math.min(0.52, 0.11 + Math.abs(value) / 34);
  const backgroundColor = value >= 0 ? `rgba(37, 126, 114, ${alpha})` : `rgba(183, 70, 94, ${alpha})`;
  return <span className={`return-cell ${value >= 0 ? 'is-gain' : 'is-loss'}`} style={{ backgroundColor, color: Math.abs(value) > 15 ? '#fff' : undefined }}>{pct(value).replace(' %', '')}</span>;
}

function periodReturn(values: (number | null)[]) {
  const observed = values.filter((value): value is number => value !== null);
  return observed.length ? observed.reduce((result, value) => result * (1 + value / 100), 1) * 100 - 100 : 0;
}

export function MonthlyReturnsPanel({ rows, selected, onSelect }: {
  rows: MonthlyReturnRow[];
  selected: string | null;
  onSelect: (symbol: string | null) => void;
}) {
  return (
    <section className="portfolio-panel portfolio-returns-panel" aria-labelledby="returns-heading">
      <header className="portfolio-panel-heading"><div><h2 id="returns-heading">Rendements mensuels</h2><p>Variations mensuelles simulées · en %</p></div><span>Mois courant partiel</span></header>
      <div className="portfolio-table-scroll returns-table-scroll">
        <table className="portfolio-table returns-table">
          <caption className="sr-only">Rendements mensuels fictifs en pourcentage par actif.</caption>
          <thead><tr><th scope="col">Actif</th>{monthLabels.map((month, index) => <th scope="col" key={`${month}-${index}`}>{month}</th>)}<th scope="col">Période</th></tr></thead>
          <tbody>{rows.map((row) => {
            const total = periodReturn(row.values);
            return <tr key={row.symbol} className={`${row.symbol === 'MODEL' ? 'is-model' : ''} ${selected === row.symbol ? 'is-selected' : ''}`}>
              <th scope="row"><button className="return-asset-button" onClick={() => onSelect(row.symbol === 'MODEL' ? null : row.symbol)} aria-pressed={selected === row.symbol}><i style={{ background: row.color }} />{row.name}</button></th>
              {row.values.map((value, index) => <td key={`${row.symbol}-${index}`}><ReturnCell value={value} /></td>)}
              <td className={total >= 0 ? 'portfolio-positive' : 'portfolio-negative'}>{pct(total)}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </section>
  );
}
