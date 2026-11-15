import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceDot, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowUpRight, BookOpen } from 'lucide-react';
import { ChartContainer, type ChartConfig } from '../analysis-workspace/ArchivedChart';
import { simulationPointOffset, type SimulationProjection } from '../../shared/api';
import { EventVisual, eventCategory } from './EventVisual';
import { dateStamp, fullDate, moneyLabel, numberLabel } from './presentation';
import type { ExplorationTarget, ExploreHandler } from './types';

export type TimelinePrice = { date: string; timestamp: number; adjustedClose: number; volume?: number };
export type TimelineMarker = { target: ExplorationTarget; date: string };
type PlotRow = { x: number; date?: string; adjustedClose?: number; volume?: number; offset?: number; [key: string]: string | number | [number, number] | undefined };
type MarkerGroup = { x: number; price: number; items: ExplorationTarget[]; lane: number };
export const forecastColors = ['#7357bb', '#168b80', '#be862b', '#8960c1'];
const chartConfig: ChartConfig = { adjustedClose: { label: 'Cours ajusté', color: '#356ce0' }, volume: { label: 'Volume', color: '#c9d9f3' } };
function PlotTooltip({ active, payload, currency, projection }: { active?: boolean; payload?: { payload?: PlotRow }[]; currency: string; projection?: SimulationProjection }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return <div className="hx-plot-tooltip"><strong>{row.date ? fullDate(row.date) : `Estimation · +${row.offset} ${projection?.timeUnit === 'calendar_days' ? 'jours' : 'séances'}`}</strong>
    {row.adjustedClose !== undefined && <p><span>Clôture ajustée</span><b>{moneyLabel(row.adjustedClose, currency)}</b></p>}
    {row.volume !== undefined && <p><span>Volume</span><b>{numberLabel(row.volume)}</b></p>}
    {projection?.branches.map((branch, index) => typeof row[`median${index}`] === 'number' && <p key={branch.id}><span>{branch.title}</span><b>{moneyLabel(row[`median${index}`] as number, currency)}</b></p>)}
    {Array.isArray(row.band0) && <small>Intervalle p10–p90 : {moneyLabel(row.band0[0], currency)} – {moneyLabel(row.band0[1], currency)}</small>}
  </div>;
}
export function MarketTimelineChart({ prices, markers, projection, showPrice, showVolume, onExplore, onSelect, currency, analysis, reducedMotion, priceSource, ticker }: {
  prices: TimelinePrice[]; markers: TimelineMarker[]; projection?: SimulationProjection;
  showPrice: boolean; showVolume: boolean; onExplore: ExploreHandler; onSelect: (index: number) => void;
  currency: string; analysis?: ExplorationTarget; reducedMotion: boolean; priceSource?:ExplorationTarget['source'];ticker:string;
}) {
  const [preview, setPreview] = useState<{ group: MarkerGroup; left: number; top: number }>();
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chartRef = useRef<HTMLDivElement>(null);
  useEffect(()=>()=>clearTimeout(hoverTimer.current),[]);
  const uid = useId().replace(/:/g, '');
  const lastIndex = prices.length - 1;
  const compatible = projection?.asOf === prices.at(-1)?.date ? projection : undefined;
  const horizon=compatible?(compatible.timeUnit==='calendar_days'?compatible.horizonDays:compatible.horizonObservations):0;
  const futureScale=compatible?Math.max(1,prices.length*.32/horizon):1;
  const data = useMemo<PlotRow[]>(() => {
    const historical: PlotRow[] = prices.map((point, index) => ({ ...point, x: index }));
    if (!compatible || !historical.length) return historical;
    const points = new Map<number, PlotRow>();
    compatible.branches.forEach((branch, index) => branch.path.forEach(point => {
      const offset = simulationPointOffset(point);
      const row = points.get(offset) || { x: lastIndex + offset*futureScale, offset };
      row[`median${index}`] = point.medianPrice;
      if (index === 0) row.band0 = [point.lowerPrice, point.upperPrice];
      points.set(offset, row);
    }));
    const start = points.get(0);
    if (start) Object.assign(historical[lastIndex], start, { date: prices[lastIndex].date });
    return [...historical, ...[...points.values()].filter(row => row.offset! > 0).sort((a, b) => a.x - b.x)];
  }, [prices, compatible, lastIndex, futureScale]);
  const groups = useMemo(() => {
    const byIndex = new Map<number, MarkerGroup>();
    markers.forEach(marker => {
      // Never attach a document before the visible range to its first visible price.
      const stamp = dateStamp(marker.date);
      if (!prices.length || stamp < prices[0].timestamp || stamp > prices.at(-1)!.timestamp) return;
      const index = prices.findIndex(point => point.timestamp >= stamp);
      if (index < 0) return;
      const group = byIndex.get(index) || { x: index, price: prices[index].adjustedClose, items: [], lane: byIndex.size % 3 };
      if (!group.items.some(item => item.id === marker.target.id)) group.items.push(marker.target);
      group.items.sort((a,b)=>Number(b.kind==='movement')-Number(a.kind==='movement'));
      byIndex.set(index, group);
    });
    return [...byIndex.values()];
  }, [markers, prices]);
  const dismiss = () => { hoverTimer.current = setTimeout(() => setPreview(undefined), 180); };
  const keep = () => { clearTimeout(hoverTimer.current); };
  const previewGroup = (group: MarkerGroup, cx: number, cy: number) => {
    keep();
    setPreview({ group, left: cx, top: Math.max(8, cy - 228) });
  };
  const openPoint = (row: PlotRow) => {
    if (row.date) {
      const index = prices.findIndex(point => point.date === row.date); onSelect(index);
      onExplore({ id: `price:${row.date}`, kind: 'point', source:priceSource,ticker, title: `Clôture du ${fullDate(row.date)}`, date: row.date, summary: 'Cours ajusté observé dans le jeu historique.', classification: 'historical', metrics: [{ label: 'Clôture ajustée', value: moneyLabel(row.adjustedClose!, currency) }] });
    } else if (compatible) onExplore({ id: `forecast:${row.offset}`, kind: 'point',ticker, source:compatible.sourceUrl?{title:'Source des cours du modèle',url:compatible.sourceUrl}:undefined, title: `Trajectoire estimée · +${row.offset} ${compatible.timeUnit==='calendar_days'?'jours':'séances'}`, summary: compatible.method, classification: 'conditional', date: compatible.asOf, metrics: compatible.branches.flatMap((branch, index) => typeof row[`median${index}`] === 'number' ? [{ label: branch.title, value: moneyLabel(row[`median${index}`] as number, currency) }] : []) });
  };
  const futureEnd = data.at(-1)?.x ?? lastIndex;
  const ticks = [...new Set([0, Math.round(lastIndex / 3), Math.round(lastIndex * 2 / 3), lastIndex, ...(compatible ? [futureEnd] : [])])];
  return <div className="hx-timeline-plot" ref={chartRef} onKeyDown={event => { if (event.key === 'Escape') setPreview(undefined); }}>
    <ChartContainer config={chartConfig} className="hx-chart" style={{ height: 365, width: '100%', aspectRatio: 'auto' }}><ComposedChart accessibilityLayer data={data} margin={{ top: 40, right: showVolume ? 6 : 14, bottom: 14, left: 0 }} onClick={state => { const row = data.find(item => item.x === Number(state.activeLabel)); if (row) openPoint(row); }}>
      <defs><linearGradient id={`${uid}-price`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6e9cec" stopOpacity={0.18} /><stop offset="100%" stopColor="#6e9cec" stopOpacity={0.015} /></linearGradient></defs>
      <CartesianGrid vertical={false} stroke="#e7edf5" strokeDasharray="3 5" />
      <XAxis dataKey="x" type="number" domain={[0, futureEnd]} ticks={ticks} minTickGap={14} tickFormatter={value => Number(value) > lastIndex ? `+${Math.round((Number(value) - lastIndex)/futureScale)} ${compatible?.timeUnit==='calendar_days'?'j':'s'}` : new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(prices[Math.min(lastIndex, Math.round(Number(value)))]?.timestamp)} axisLine={false} tickLine={false} fontSize={11} tickMargin={12} />
      <YAxis yAxisId="price" domain={['auto', 'auto']} width={57} tickFormatter={value => numberLabel(Number(value))} axisLine={false} tickLine={false} fontSize={11} tickMargin={8} />
      <YAxis yAxisId="volume" orientation="right" hide domain={[0, (max: number) => max * 4]} />
      <Tooltip cursor={{ stroke: '#9cb2d4', strokeDasharray: '3 4' }} content={<PlotTooltip currency={currency} projection={compatible} />} />
      {compatible && <ReferenceArea yAxisId="price" x1={lastIndex} x2={futureEnd} fill="#8f7bd1" fillOpacity={0.065} />}
      {showVolume && <Bar yAxisId="volume" dataKey="volume" fill="#d3e0f3" opacity={0.7} barSize={Math.max(1, Math.min(8, 600 / prices.length))} isAnimationActive={false} />}
      {showPrice && <Area yAxisId="price" dataKey="adjustedClose" type="linear" stroke="#356ce0" strokeWidth={2} fill={`url(#${uid}-price)`} isAnimationActive={!reducedMotion} connectNulls={false} />}
      {compatible && <ReferenceLine yAxisId="price" x={lastIndex} stroke="#b8a8df" strokeDasharray="4 4" />}
      {compatible && <Area yAxisId="price" dataKey="band0" stroke="none" fill="#8d73c7" fillOpacity={0.15} isAnimationActive={false} />}
      {compatible?.branches.map((branch, index) => <Line key={branch.id} yAxisId="price" type="linear" dataKey={`median${index}`} stroke={forecastColors[index]} strokeWidth={2} strokeDasharray="4 3" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />)}
      {compatible?.branches[0]&&<ReferenceDot yAxisId="price" x={futureEnd} y={compatible.branches[0].path.at(-1)!.medianPrice} r={4} fill={forecastColors[0]} stroke="white" shape={props=><g><circle cx={props.cx} cy={props.cy} r={4} fill={forecastColors[0]} stroke="white" strokeWidth={2}/><text x={(props.cx??0)-6} y={(props.cy??0)-12} textAnchor="end" fill={forecastColors[0]} fontSize={11} fontWeight={600}>{numberLabel(compatible.branches[0].path.at(-1)!.medianPrice)}</text></g>}/>}
      {groups.map(group => <ReferenceDot key={group.x} yAxisId="price" x={group.x} y={group.price} ifOverflow="visible" shape={props => {
        const cx = props.cx ?? 0, cy = props.cy ?? 0, y = Math.max(0, cy - 45 - group.lane * 25);
        const category = eventCategory(group.items[0]);
        const movement = group.items[0].movement;
        return <g><line x1={cx} x2={cx} y1={cy} y2={y + 24} stroke={category.color} strokeOpacity={0.5} strokeDasharray="2 3" /><circle cx={cx} cy={cy} r={3} fill={category.color} stroke="white" />
          <foreignObject x={cx - (movement ? 37 : 17)} y={y} width={movement ? 82 : 42} height={39} style={{ overflow: 'visible' }}><button type="button" className={`hx-rich-marker${movement ? ' hx-move-marker' : ''}${preview?.group.x === group.x ? ' is-active' : ''}`} style={{ '--event-color': category.color } as React.CSSProperties} aria-label={`Explorer ${group.items[0].title}${group.items.length > 1 ? ` et ${group.items.length - 1} autre événement` : ''}`} onMouseEnter={() => previewGroup(group, cx, y)} onMouseLeave={dismiss} onFocus={() => previewGroup(group, cx, y)} onBlur={dismiss} onClick={event => { event.stopPropagation(); keep(); onExplore(group.items[0]); setPreview(undefined); }}><EventVisual target={group.items[0]} />{movement && <span className="hx-move-label">{movement.changePct > 0 ? '+' : ''}{numberLabel(movement.changePct)} %</span>}{group.items.length > 1 && <span className="hx-marker-count">{group.items.length}</span>}</button></foreignObject>
        </g>;
      }} />)}
    </ComposedChart></ChartContainer>
    {preview && <div className="hx-event-preview" role="region" aria-label="Aperçu des événements" style={{ left: `clamp(8px, ${preview.left - 150}px, calc(100% - 310px))`, top: preview.top }} onMouseEnter={keep} onMouseLeave={dismiss} onFocus={keep} onBlur={dismiss}>
      {preview.group.items.slice(0, 4).map(target => <button type="button" key={target.id} onClick={() => { setPreview(undefined); onExplore(target); }}><EventVisual target={target} /><span><small>{eventCategory(target).label} · {target.dateLabel || fullDate(target.date)}</small><strong>{target.title}</strong><em>{target.source?.publisher || 'Source du jeu'} <ArrowUpRight size={12} /></em></span></button>)}
      {preview.group.items.length > 4 && <small>+ {preview.group.items.length - 4} événements à cette clôture</small>}
      {analysis && <button type="button" className="hx-preview-analysis" onClick={() => { setPreview(undefined); onExplore(analysis); }}><BookOpen size={14} /> Lire l’analyse associée</button>}
    </div>}
    {compatible && <span className="hx-future-label">Estimation p10–p90 <small>Échelle future agrandie</small></span>}
  </div>;
}
