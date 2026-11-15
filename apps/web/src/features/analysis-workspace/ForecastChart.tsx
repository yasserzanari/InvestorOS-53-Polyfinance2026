import { useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from './ArchivedChart';
import type { ExploreHandler, ExplorationTarget } from '../analysis-interactions/types';
import { seriesPointTarget, type SeriesPoint } from './types';
import './scenario.css';

export type ForecastSeries = { id: string; label: string; color: string; points: SeriesPoint[]; dashed?: boolean; target?:ExplorationTarget };
export type ForecastChartProps = { series: ForecastSeries[]; unit: string; height?: number; compact?: boolean; yDomain?: [number, number]; horizonDays?: number; showUnit?: boolean; onExplore?:ExploreHandler };
const numeric = new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 2 });

export function ForecastChart({ series, unit, height = 190, compact = false, yDomain, horizonDays, showUnit = true, onExplore }: ForecastChartProps) {
  const reducedMotion = useReducedMotion();
  const [hidden,setHidden]=useState<string[]>([]);
  const openPoint=(item:ForecastSeries,point:SeriesPoint)=>{
    if(!onExplore||!item.target)return;
    onExplore(seriesPointTarget(item.target,item.label,point,unit));
  };
  const renderPoint=(item:ForecastSeries,active=false)=>(props:{cx?:number;cy?:number;payload?:{day?:number}})=>{
    const point=item.points.find(point=>point.day===props.payload?.day);
    if(!point||props.cx===undefined||props.cy===undefined)return <g/>;
    const interactive=Boolean(onExplore&&item.target);
    return <circle cx={props.cx} cy={props.cy} r={active?5:3} fill={active?item.color:'white'} stroke={item.color} strokeWidth={1.5} role={interactive?'button':undefined} tabIndex={interactive?0:undefined} aria-label={interactive?`Explorer ${item.label} à +${point.day} jours : ${numeric.format(point.value)} ${unit}`:undefined} onClick={interactive?()=>openPoint(item,point):undefined} onKeyDown={interactive?event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();openPoint(item,point);}}:undefined} className={interactive?'av-interactive-point':undefined}><title>{item.label} · +{point.day} jours · {numeric.format(point.value)} {unit}</title></circle>;
  };
  const { rows, config } = useMemo(() => {
    const days = [...new Set(series.flatMap(item => item.points.map(point => point.day)))].sort((a, b) => a - b);
    const config: ChartConfig = {};
    series.forEach((item, index) => { config[`s${index}`] = { label: item.label, color: item.color }; });
    const rows = days.map(day => {
      const row: Record<string, number | number[] | undefined> = { day };
      series.forEach((item, index) => {
        const point = item.points.find(point => point.day === day);
        row[`s${index}`] = point?.value;
        if (point?.lower !== undefined && point.upper !== undefined) row[`band${index}`] = [point.lower, point.upper];
      });
      return row;
    });
    return { rows, config };
  }, [series]);
  if (!rows.length) return <p className="av-no-series">Aucune série temporelle fournie pour cette analyse.</p>;
  return <div className="av-forecast">
    {showUnit && <div className="av-chart-unit">{unit}</div>}
    <ChartContainer config={config} className="av-chart-container" style={{ height, width: '100%', minWidth: 0, aspectRatio: 'auto' }}>
      <ComposedChart accessibilityLayer data={rows} margin={{ top: 12, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="#e4eaf4" strokeDasharray="3 3" />
        <XAxis dataKey="day" type="number" domain={horizonDays !== undefined ? [0, horizonDays] : ['dataMin', 'dataMax']} tickFormatter={value => Number(value) === 0 ? "Aujourd’hui" : `+${value} j`} tickLine={false} axisLine={false} fontSize={10} tickMargin={10} minTickGap={20} />
        <YAxis width={48} domain={yDomain ?? ['auto', 'auto']} tickFormatter={value => numeric.format(value)} tickLine={false} axisLine={false} fontSize={10} tickMargin={5} />
        <ChartTooltip content={<ChartTooltipContent className="av-chart-tooltip" labelFormatter={(_, payload) => `Horizon : +${payload[0]?.payload.day ?? 0} jours`} formatter={(value, name) => <span className="av-chart-tooltip-value"><span>{config[String(name)]?.label ?? name}</span><strong>{Array.isArray(value) ? value.map(Number).map(v => numeric.format(v)).join(' – ') : numeric.format(Number(value))} {unit}</strong></span>} />} />
        {series.filter(item=>!hidden.includes(item.id)).map(item => {const index=series.indexOf(item);return <Area key={`band-${item.id}`} dataKey={`band${index}`} type="linear" stroke="none" fill={item.color} fillOpacity={0.1} legendType="none" tooltipType="none" connectNulls={false} isAnimationActive={!reducedMotion} />;})}
        {series.filter(item=>!hidden.includes(item.id)).map(item => {const index=series.indexOf(item);return <Line key={item.id} name={`s${index}`} dataKey={`s${index}`} type="linear" stroke={item.color} strokeWidth={2} strokeDasharray={item.dashed ? '5 4' : undefined} dot={renderPoint(item)} activeDot={renderPoint(item,true)} connectNulls={false} isAnimationActive={!reducedMotion} />;})}
        <ChartLegend height={compact?28:38} content={()=><div className="av-forecast-legend" style={{maxHeight:compact?28:38,overflowY:'auto'}} aria-label="Séries du graphique">{series.map((item,index)=><button type="button" key={item.id} aria-label={`${hidden.includes(item.id)?'Afficher':'Masquer'} la série ${item.label}`} aria-pressed={!hidden.includes(item.id)} onClick={()=>setHidden(current=>current.includes(item.id)?current.filter(id=>id!==item.id):[...current,item.id])}><ChartLegendContent className="av-legend-entry" payload={[{value:item.label,dataKey:`s${index}`,color:item.color,type:'line'}]}/></button>)}</div>}/>

      </ComposedChart>
    </ChartContainer>
    {series.every(item=>hidden.includes(item.id))&&<p className="av-no-series" role="status">Les séries sont masquées. Utilisez la légende pour les réafficher.</p>}
    <details className="av-chart-data"><summary>Valeurs du graphique</summary><div className="av-table-scroll"><table><caption>Séries fournies · {unit}</caption><thead><tr><th>Horizon</th>{series.map(item => <th key={item.id}>{item.label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={Number(row.day)}><th>+{row.day} j</th>{series.map((item, index) => { const point = item.points.find(p => p.day === row.day); return <td key={index}>{point ? <>{onExplore&&item.target?<button type="button" className="av-chart-value-button" onClick={()=>openPoint(item,point)} aria-label={`Explorer ${item.label} à +${point.day} jours`}>{numeric.format(point.value)}</button>:numeric.format(point.value)}{point.lower !== undefined && point.upper !== undefined && <small> [{numeric.format(point.lower)} – {numeric.format(point.upper)}]</small>}</> : '—'}</td>; })}</tr>)}</tbody></table></div></details>
  </div>;
}
