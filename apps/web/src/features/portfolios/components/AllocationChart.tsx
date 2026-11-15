import { useMemo } from 'react';
export type AllocationItem = { symbol: string; name: string; weight: number; value: number; color: string };

const polar = (angle: number, radius: number) => ({ x: 180 + Math.cos(angle) * radius, y: 140 + Math.sin(angle) * radius });

function arc(start: number, end: number, radius: number) {
  const a = polar(start, radius);
  const b = polar(end, radius);
  return `M ${a.x} ${a.y} A ${radius} ${radius} 0 ${end - start > Math.PI ? 1 : 0} 1 ${b.x} ${b.y}`;
}

type AllocationChartProps = {
  positions: AllocationItem[];
  total: number;
  selected: string | null;
  onSelect: (symbol: string) => void;
};

export function AllocationChart({ positions, total, selected, onSelect }: AllocationChartProps) {
  const sectors = useMemo(() => {
    const totalWeight = positions.reduce((sum, item) => sum + item.weight, 0);
    let consumed = 0;
    return positions.map((position) => {
      const start = -Math.PI / 2 + consumed / Math.max(1, totalWeight) * Math.PI * 2;
      const end = start + position.weight / Math.max(1, totalWeight) * Math.PI * 2;
      consumed += position.weight;
      return { position, start, end, middle: (start + end) / 2 };
    });
  }, [positions]);

  return (
    <div className="portfolio-allocation-chart">
      <svg viewBox="0 0 360 280" role="group" aria-label={`Répartition du portefeuille, valeur totale ${total.toLocaleString('fr-CA')}.`}>
        <circle cx="180" cy="140" r="99" fill="none" stroke="#edf1f3" strokeWidth="19" />
        {sectors.map(({ position, start, end }) => <g
          key={position.symbol}
          className="allocation-sector"
          role="button"
          tabIndex={0}
          aria-pressed={selected === position.symbol}
          aria-label={`Afficher ${position.name}, ${position.weight.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} %`}
          opacity={selected && selected !== position.symbol ? 0.28 : 1}
          onClick={() => onSelect(position.symbol)}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(position.symbol); } }}
        >
          <path d={arc(start + 0.016, end - 0.016, 99)} fill="none" stroke={position.color} strokeWidth="19" />
        </g>)}
        <text x="180" y="129" textAnchor="middle" className="allocation-center-caption">PORTEFEUILLE</text>
        <text x="180" y="154" textAnchor="middle" className="allocation-center-value">{new Intl.NumberFormat('fr-CA', { notation: 'compact', maximumFractionDigits: 1 }).format(total)}</text>
      </svg>
      <ul className="allocation-legend" aria-label="Pondérations du portefeuille">
        {positions.map((position) => <li key={position.symbol}>
          <button type="button" className={selected === position.symbol ? 'is-selected' : ''} aria-pressed={selected === position.symbol} aria-label={`Afficher ${position.name}, ${position.weight.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} %`} onClick={() => onSelect(position.symbol)}>
            <span className="allocation-legend-swatch" style={{ background: position.color }} />
            <strong title={position.name}>{position.name}</strong>
            <span className="allocation-legend-weight">{position.weight.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} %</span>
          </button>
        </li>)}
      </ul>
    </div>
  );
}
