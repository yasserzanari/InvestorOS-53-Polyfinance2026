import { useMemo } from 'react';
import type { PortfolioPosition } from '../model/portfolio-model';

const polar = (angle: number, radius: number) => ({ x: 160 + Math.cos(angle) * radius, y: 127 + Math.sin(angle) * radius });

function arc(start: number, end: number, radius: number) {
  const a = polar(start, radius);
  const b = polar(end, radius);
  return `M ${a.x} ${a.y} A ${radius} ${radius} 0 ${end - start > Math.PI ? 1 : 0} 1 ${b.x} ${b.y}`;
}

type AllocationChartProps = {
  positions: PortfolioPosition[];
  total: number;
  selected: string | null;
  onSelect: (symbol: string) => void;
};

export function AllocationChart({ positions, total, selected, onSelect }: AllocationChartProps) {
  const sectors = useMemo(() => {
    let consumed = 0;
    return positions.map((position) => {
      const start = -Math.PI / 2 + consumed / 100 * Math.PI * 2;
      const end = start + position.weight / 100 * Math.PI * 2;
      consumed += position.weight;
      return { position, start, end, middle: (start + end) / 2 };
    });
  }, [positions]);

  return (
    <div className="portfolio-allocation-chart">
      <svg viewBox="0 0 320 252" role="img" aria-label={`Répartition simulée du portefeuille de ${total.toLocaleString('fr-CA')} dollars américains.`}>
        <circle cx="160" cy="127" r="91" fill="none" stroke="#edf1f3" strokeWidth="17" />
        {sectors.map(({ position, start, end }) => <g key={position.symbol} opacity={selected && selected !== position.symbol ? 0.23 : 1}>
          <path d={arc(start + 0.016, end - 0.016, 91)} fill="none" stroke={position.color} strokeWidth="15" />
          <path d={arc(start + 0.016, end - 0.016, 105)} fill="none" stroke={position.color} strokeWidth="1.5" opacity=".55" />
        </g>)}
        {sectors.map(({ position, middle }) => {
          const start = polar(middle, 101);
          const end = polar(middle, 109);
          const label = polar(middle, 126);
          const x = Math.max(30, Math.min(290, label.x));
          const y = Math.max(17, Math.min(237, label.y));
          return <g key={`label-${position.symbol}`} className="allocation-label" role="button" tabIndex={0} aria-pressed={selected === position.symbol} aria-label={`Afficher ${position.name}, ${position.weight.toFixed(1)} %; cible ${position.target} %`} onClick={() => onSelect(position.symbol)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(position.symbol); } }}>
            <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#71818c" strokeWidth="1.2" />
            <rect x={x - 26} y={y - 15} width="52" height="34" rx="5" fill={selected === position.symbol ? '#eef5f5' : '#fff'} />
            <text x={x} y={y - 1} textAnchor="middle" className="allocation-symbol">{position.symbol}</text>
            <text x={x} y={y + 13} textAnchor="middle" className="allocation-weight">{position.weight.toFixed(1)} %</text>
          </g>;
        })}
        <text x="160" y="116" textAnchor="middle" className="allocation-center-caption">PORTEFEUILLE MODÈLE</text>
        <text x="160" y="139" textAnchor="middle" className="allocation-center-value">{(total / 1_000_000).toFixed(2)} M$</text>
      </svg>
      <ul className="allocation-legend" aria-label="Cibles de répartition">
        {positions.map((position) => <li key={position.symbol}><span style={{ background: position.color }} /><strong>{position.symbol}</strong><span>{position.weight.toFixed(1)} %</span><small>Cible {position.target} %</small></li>)}
      </ul>
    </div>
  );
}
