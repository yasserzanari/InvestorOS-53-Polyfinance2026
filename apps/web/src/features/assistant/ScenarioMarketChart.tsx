import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { LegendItem, LegendLabel, LegendOrdinal } from '@visx/legend';
import { scaleOrdinal } from '@visx/scale';
import { ArrowUpRight, RotateCcw } from 'lucide-react';
import { simulationEventOffset, simulationHorizon, simulationPointOffset, type SimulationProjection } from '../../shared/api';
import type { ExploreHandler } from '../analysis-interactions/types';
import { niceTicks, useElementWidth, usePrefersReducedMotion, useTween } from '../portfolios/charts/portfolio-chart/chart-engine';
import { scenarioEventTarget, scenarioMoney, scenarioOffsetLabel, scenarioPointTarget } from './scenario-exploration';

/** Area/grid/crosshair/terminal-price structure adapted from the supplied Market Chart.
 * Quantiles replace OHLC; only supplied offsets and prices are plotted, with no synthetic ticks.
 * Ordinal legend composes the exact Visx LegendItem/LegendLabel pattern with host buttons.
 */
export function ScenarioMarketChart({ branch, projection, color, onExplore }: { branch: SimulationProjection['branches'][number]; projection: SimulationProjection; color: string; onExplore?: ExploreHandler }) {
  const reduced = usePrefersReducedMotion();
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [range, setRange] = useState<'all' | 'before' | 'after'>('all');
  const [visible, setVisible] = useState({ median: true, band: true, event: true });
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const eventOffset = simulationEventOffset(branch);
  const points = useMemo(() => { const filtered = branch.path.filter(point => range === 'before' ? simulationPointOffset(point) < eventOffset : range === 'after' ? simulationPointOffset(point) >= eventOffset : true); return filtered.length ? filtered : branch.path; }, [branch.path, range, eventOffset]);
  useEffect(() => { setRange('all'); setActiveIndex(null); setPinned(false); }, [projection, branch.id]);
  const safeIndex = activeIndex === null ? null : Math.min(activeIndex, points.length - 1);
  const active = safeIndex === null ? null : points[safeIndex];
  const last = points[points.length - 1];
  const shown = active || last;
  const uid = useId().replace(/:/g, '');
  const w = Math.max(width, 280), h = 245;
  const plotX0 = 14, plotX1 = w - 78, plotY0 = 22, plotY1 = h - 34;
  const firstOffset = points.length ? simulationPointOffset(points[0]) : 0;
  const lastOffset = last ? simulationPointOffset(last) : simulationHorizon(projection);
  const xMin = firstOffset === lastOffset ? firstOffset - .5 : firstOffset;
  const xMax = firstOffset === lastOffset ? lastOffset + .5 : lastOffset;
  const x = (offset: number) => plotX0 + (offset - xMin) / (xMax - xMin) * (plotX1 - plotX0);
  const domain = useMemo(() => {
    const values = points.flatMap(point => visible.band ? [point.lowerPrice, point.upperPrice] : [point.medianPrice]);
    const lo = Math.min(...values), hi = Math.max(...values);
    const pad = (hi - lo) * .15 || Math.abs(hi) * .02 || 1;
    return [Math.max(0, lo - pad), hi + pad];
  }, [points, visible.band]);
  const [min, max] = useTween(domain, { duration: 360, enabled: !reduced });
  const y = (value: number) => plotY1 - (value - min) / (max - min || 1) * (plotY1 - plotY0);
  const medianPath = points.map((point, i) => `${i ? 'L' : 'M'}${x(simulationPointOffset(point))},${y(point.medianPrice)}`).join(' ');
  const bandPath = [...points.map((point, i) => `${i ? 'L' : 'M'}${x(simulationPointOffset(point))},${y(point.upperPrice)}`), ...points.slice().reverse().map(point => `L${x(simulationPointOffset(point))},${y(point.lowerPrice)}`), 'Z'].join(' ');
  const priceTicks = niceTicks(min, max, 7);
  const timeTicks = [...new Set(points.filter((_, i) => i === 0 || i === points.length - 1 || i % Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(w / 110)))) === 0).map(simulationPointOffset))];
  const eventInRange = eventOffset >= firstOffset && eventOffset <= lastOffset;
  const change = (shown.medianPrice / projection.startingPrice - 1) * 100;
  const axis = (value: number) => new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 2, notation: value >= 10000 ? 'compact' : 'standard' }).format(value);
  const legendScale = useMemo(() => scaleOrdinal({ domain: ['median', 'band', 'event'], range: [color, color, '#da8b2e'] }), [color]);
  const legendLabels = { median: 'Médiane conditionnelle', band: 'Bande p10–p90', event: 'Choc hypothétique' };
  const explorePoint = (index: number) => { setActiveIndex(index); setPinned(true); onExplore?.(scenarioPointTarget(projection, branch, points[index])); };
  const selectRange = (next: typeof range) => { setRange(next); setActiveIndex(null); setPinned(false); };
  const keyboard = (event: KeyboardEvent<SVGSVGElement>) => {
    if (!points.length) return;
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); setPinned(true);
      setActiveIndex(event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : Math.max(0, Math.min(points.length - 1, (safeIndex ?? points.length - 1) + (event.key === 'ArrowLeft' ? -1 : 1))));
    } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); explorePoint(safeIndex ?? points.length - 1); }
    else if (event.key === 'Escape') { event.preventDefault(); setPinned(false); setActiveIndex(null); }
  };
  return <figure ref={wrapRef} className="assistant-market-chart" style={{ '--scenario-chart-color': color } as CSSProperties}>
    <div className="assistant-market-chart-top"><div><span>{active ? 'Jalon sélectionné' : 'Médiane à l’horizon affiché'}</span><div className="assistant-market-chart-price"><strong>{scenarioMoney(shown.medianPrice, projection.currency)}</strong><span className={change < 0 ? 'is-down' : ''}>{change >= 0 ? '+' : ''}{new Intl.NumberFormat('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(change)} %</span></div><small>vs cours de départ · {scenarioOffsetLabel(projection, simulationPointOffset(shown))}</small></div><div className="assistant-market-ranges" role="group" aria-label="Plage de jalons affichée"><button type="button" aria-pressed={range === 'all'} onClick={() => selectRange('all')}>Tout</button><button type="button" aria-pressed={range === 'before'} disabled={!branch.path.some(point => simulationPointOffset(point) < eventOffset)} onClick={() => selectRange('before')}>Avant choc</button><button type="button" aria-pressed={range === 'after'} onClick={() => selectRange('after')}>Après choc</button></div></div>
    <div className="assistant-market-chart-unit">{projection.currency} · {projection.model?'trajectoires bootstrap':'quantiles historiques conditionnés'}</div>
    <svg ref={svgRef} width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="assistant-market-plot" role="group" tabIndex={0} aria-label={`Graphique conditionnel ${branch.title}. Flèches pour choisir un jalon; Entrée pour ouvrir sa fiche.`} aria-describedby={`${uid}-description`} onKeyDown={keyboard} onPointerMove={event => { if (pinned || !points.length) return; const rect = event.currentTarget.getBoundingClientRect(); const pointerX = (event.clientX - rect.left) / rect.width * w; let index = 0; points.forEach((point, i) => { if (Math.abs(x(simulationPointOffset(point)) - pointerX) < Math.abs(x(simulationPointOffset(points[index])) - pointerX)) index = i; }); setActiveIndex(index); }} onPointerLeave={() => { if (!pinned && !svgRef.current?.contains(document.activeElement)) setActiveIndex(null); }}>
      <defs><linearGradient id={`${uid}-band`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".23"/><stop offset="100%" stopColor={color} stopOpacity=".04"/></linearGradient><clipPath id={`${uid}-plot`}><rect x={plotX0 - 7} y={plotY0 - 8} width={plotX1 - plotX0 + 14} height={plotY1 - plotY0 + 16}/></clipPath></defs>
      <g className="assistant-market-axis">{priceTicks.map(tick => <g key={tick}><line x1={plotX0} x2={plotX1} y1={y(tick)} y2={y(tick)} stroke="#dbe5f2" strokeDasharray="2 4"/><text x={plotX1 + 10} y={y(tick)} dominantBaseline="middle">{axis(tick)}</text></g>)}{timeTicks.map(offset => <text key={offset} x={x(offset)} y={h - 10} textAnchor={offset === firstOffset ? 'start' : offset === lastOffset ? 'end' : 'middle'}>+{offset}{projection.timeUnit === 'calendar_days' ? ' j' : ' s'}</text>)}</g>
      <g clipPath={`url(#${uid}-plot)`}>{visible.band && <path d={bandPath} fill={`url(#${uid}-band)`} className="assistant-market-band"/>}{visible.median && <><path d={medianPath} fill="none" stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="assistant-market-line"/>{points.map((point, i) => <g key={simulationPointOffset(point)} role="button" tabIndex={0} aria-label={`Ouvrir le jalon +${scenarioOffsetLabel(projection, simulationPointOffset(point))}, médiane ${scenarioMoney(point.medianPrice, projection.currency)}`} className="assistant-market-point" onFocus={() => setActiveIndex(i)} onClick={() => explorePoint(i)} onKeyDown={event => {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
          event.preventDefault(); event.stopPropagation();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : Math.max(0, Math.min(points.length - 1, i + (event.key === 'ArrowLeft' ? -1 : 1)));
          setPinned(true); setActiveIndex(next); svgRef.current?.querySelectorAll<SVGGElement>('.assistant-market-point')[next]?.focus();
        } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); explorePoint(i); }
      }}><circle cx={x(simulationPointOffset(point))} cy={y(point.medianPrice)} r="10" fill="transparent"/><circle cx={x(simulationPointOffset(point))} cy={y(point.medianPrice)} r={i === safeIndex ? 4.5 : 3} fill="white" stroke={color} strokeWidth="1.8"/><title>{scenarioOffsetLabel(projection, simulationPointOffset(point))} · p10 {scenarioMoney(point.lowerPrice, projection.currency)} · p50 {scenarioMoney(point.medianPrice, projection.currency)} · p90 {scenarioMoney(point.upperPrice, projection.currency)}</title></g>)}</>}{active && <line x1={x(simulationPointOffset(active))} x2={x(simulationPointOffset(active))} y1={plotY0} y2={plotY1} stroke="#91a4c1" strokeDasharray="3 3" pointerEvents="none"/>}</g>
      {visible.event && branch.shockPct !== 0 && eventInRange && <g role="button" tabIndex={0} className="assistant-market-event" aria-label={`Examiner l’hypothèse : ${branch.event}, choc ${branch.shockPct} %, après ${scenarioOffsetLabel(projection, eventOffset)}`} onClick={() => onExplore?.(scenarioEventTarget(projection, branch))} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onExplore?.(scenarioEventTarget(projection, branch)); } }}><line x1={x(eventOffset)} x2={x(eventOffset)} y1={plotY0} y2={plotY1} stroke="#d68a2c" strokeDasharray="5 5" pointerEvents="none"/><circle cx={x(eventOffset)} cy="11" r="9" fill="#fff0d9" stroke="#dd9d42"/><text x={x(eventOffset)} y="14" textAnchor="middle" fill="#99631d" fontSize="10" fontWeight="600">E</text><title>{branch.event} · hypothèse conditionnelle</title></g>}
      {last && visible.median && <g pointerEvents="none"><rect x={plotX1 + 3} y={y(last.medianPrice) - 10} width="70" height="20" rx="4" fill={color}/><text x={plotX1 + 38} y={y(last.medianPrice)} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="10.5" fontWeight="600">{axis(last.medianPrice)}</text></g>}
    </svg>
    <div className="assistant-market-legend" aria-label="Légende du graphique"><LegendOrdinal scale={legendScale}>{items => <div className="assistant-market-legend-items">{items.map(item => { const key = item.datum as keyof typeof visible; return <LegendItem key={key} margin="0"><button type="button" aria-pressed={visible[key]} onClick={() => setVisible(value => ({ ...value, [key]: !value[key] }))}><svg width="20" height="14" aria-hidden="true">{key === 'band' ? <rect x="1" y="2" width="18" height="10" rx="2" fill={String(item.value)} fillOpacity=".18" stroke={String(item.value)} strokeOpacity=".4"/> : key === 'event' ? <line x1="10" x2="10" y1="1" y2="13" stroke={String(item.value)} strokeWidth="2" strokeDasharray="3 2"/> : <><line x1="0" x2="20" y1="7" y2="7" stroke={String(item.value)} strokeWidth="2"/><circle cx="10" cy="7" r="3" fill="white" stroke={String(item.value)}/></>}</svg><LegendLabel margin="0 0 0 5px">{legendLabels[key]}</LegendLabel></button></LegendItem>; })}</div>}</LegendOrdinal></div>
    <div className="assistant-market-readout" aria-live="polite"><span>{active ? `+${scenarioOffsetLabel(projection, simulationPointOffset(active))}` : 'Sélectionnez un jalon'}{active && <> · p10 <b>{scenarioMoney(active.lowerPrice, projection.currency)}</b> · p50 <b>{scenarioMoney(active.medianPrice, projection.currency)}</b> · p90 <b>{scenarioMoney(active.upperPrice, projection.currency)}</b></>}</span>{active && onExplore && <button type="button" onClick={() => explorePoint(safeIndex!)}>Ouvrir la fiche <ArrowUpRight size={13}/></button>}{pinned && <button type="button" aria-label="Libérer la sélection du graphique" onClick={() => { setPinned(false); setActiveIndex(null); }}><RotateCcw size={13}/></button>}</div>
    <figcaption id={`${uid}-description`}>Relier les jalons ne transforme pas leurs quantiles marginaux en trajectoire prédite. La bande p10–p90 n’est pas une probabilité du scénario.</figcaption>
  </figure>;
}
