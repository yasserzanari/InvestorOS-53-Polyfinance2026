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
      <svg viewBox="0 0 360 280" role="img" aria-label={`Répartition du portefeuille fictif, valeur totale ${total.toLocaleString('fr-CA')}.`}>
        <circle cx="180" cy="140" r="99" fill="none" stroke="#edf1f3" strokeWidth="19" />
        {sectors.map(({ position, start, end }) => <g key={position.symbol} opacity={selected && selected !== position.symbol ? 0.23 : 1}>
          <path d={arc(start + 0.016, end - 0.016, 99)} fill="none" stroke={position.color} strokeWidth="18" />
          <path d={arc(start + 0.016, end - 0.016, 115)} fill="none" stroke={position.color} strokeWidth="1.5" opacity=".55" />
        </g>)}
        {sectors.map(({ position, middle }) => {
          const start = polar(middle, 110);
          const end = polar(middle, 118);
          const label = polar(middle, 137);
          const x = Math.max(28, Math.min(332, label.x));
          const y = Math.max(20, Math.min(260, label.y));
          const labelText = position.name.length > 12 ? `${position.name.slice(0, 10)}…` : position.name;
          return <g key={`label-${position.symbol}`} className="allocation-label" role="button" tabIndex={0} aria-pressed={selected === position.symbol} aria-label={`Afficher ${position.name}, ${position.weight.toFixed(1)} %`} onClick={() => onSelect(position.symbol)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(position.symbol); } }}>
            <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#71818c" strokeWidth="1.2" />
            <rect x={x - 36} y={y - 15} width="72" height="34" rx="5" fill={selected === position.symbol ? '#eef5f5' : '#fff'} />
            <text x={x} y={y - 1} textAnchor="middle" className="allocation-symbol">{labelText}</text>
            <text x={x} y={y + 13} textAnchor="middle" className="allocation-weight">{position.weight.toFixed(1)} %</text>
          </g>;
        })}
        <text x="180" y="129" textAnchor="middle" className="allocation-center-caption">PORTEFEUILLE</text>
        <text x="180" y="154" textAnchor="middle" className="allocation-center-value">{new Intl.NumberFormat('fr-CA', { notation: 'compact', maximumFractionDigits: 1 }).format(total)}</text>
      </svg>
      <ul className="allocation-legend" aria-label="Pondérations du portefeuille">
        {positions.map((position) => <li key={position.symbol}><span style={{ background: position.color }} /><strong title={position.name}>{position.name}</strong><span>{position.weight.toFixed(1)} %</span></li>)}
      </ul>
    </div>
  );
}
