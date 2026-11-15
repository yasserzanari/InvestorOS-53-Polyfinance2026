import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Expand, Info, Layers3, X } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Label, LabelList, Pie, PieChart, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltipContent } from './chart/recharts-chart-kit';
import PositionHeatmap, { type PositionTile } from './heatmap/PositionHeatmap';
import type { FinancialWidgetData, FinancialWidgetPeriod, WidgetPeriodKey } from './types';
import './financial-widgets.css';
import './financial-widgets-inline.css';

const PERIOD_LABELS: Record<WidgetPeriodKey, string> = { '1D': 'Jour', '1W': 'Semaine', '1M': 'Mois', '1Y': '1 an' };
const COLORS = ['#2864e8', '#16a6b5', '#9163e8', '#f09a38', '#61aa58', '#da668c', '#7989a3'];
const money = (value: number, currency: string, digits = 0) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
const signedMoney = (value: number, currency: string) => (value >= 0 ? '+' : '−') + money(Math.abs(value), currency);
const signedPct = (value: number) => (value >= 0 ? '+' : '−') + Math.abs(value).toLocaleString('fr-CA', { maximumFractionDigits: 2 }) + ' %';
const dateLabel = (value: string) => !Number.isFinite(Date.parse(value)) ? 'date non fournie' : new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
const shortDate = (value: string) => new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(value));

function PeriodControls({ period, onChange }: { period: WidgetPeriodKey; onChange: (period: WidgetPeriodKey) => void }) {
  return <div className="fw-period-control" role="group" aria-label="Période des données">
    {(Object.keys(PERIOD_LABELS) as WidgetPeriodKey[]).map((key) => <button key={key} type="button" aria-pressed={period === key} onClick={() => onChange(key)}>{{'1D':'1J','1W':'1S','1M':'1M','1Y':'1A'}[key]}</button>)}
  </div>;
}

function Delta({ value, currency, kind = 'money' }: { value: number | null; currency: string; kind?: 'money' | 'percent' }) {
  if (value === null) return <span className="fw-unavailable-value">Indisponible</span>;
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={'fw-delta ' + (value >= 0 ? 'is-positive' : 'is-negative')}><Icon size={15} aria-hidden="true" />{kind === 'money' ? signedMoney(value, currency) : signedPct(value)}</span>;
}

function Unavailable({ period, title, fallback }: { period: FinancialWidgetPeriod; title: string; fallback?: ReactNode }) {
  if (period.status === 'ready') return <>{fallback}</>;
  return <div className="fw-unavailable" role="status"><span className="fw-unavailable-icon"><Info size={18} aria-hidden="true" /></span><div><strong>{period.status === 'partial' ? 'Données partielles' : title}</strong><p>{period.reason || (period.status === 'partial' ? 'Certains éléments ne sont pas disponibles pour cette période.' : 'Les données nécessaires à cette période ne sont pas disponibles.')}</p></div></div>;
}

function SummaryMeta({ widget }: { widget: FinancialWidgetData }) {
  return <details className="fw-provenance"><summary><Info size={13} aria-hidden="true" /> Source et limites</summary><div className="fw-provenance-details">
    <p><strong>Source :</strong> {widget.provenance.source} · {widget.provenance.classification}</p><p><strong>Méthode :</strong> {widget.provenance.method}</p>
    {[...new Set([...widget.provenance.limitations, ...widget.limitations])].map((item) => <p key={item}>{item}</p>)}
  </div></details>;
}

function PortfolioView({ widget, periodKey, period, expanded = false, onExpand }: { widget: FinancialWidgetData; periodKey: WidgetPeriodKey; period: FinancialWidgetPeriod; expanded?: boolean; onExpand?:()=>void }) {
  const reduced=useReducedMotion();
  const rows = useMemo(() => period.points.map((point, index) => ({ ...point, label: shortDate(point.date), reference: period.points[0]?.value ?? point.value, index })), [period.points]);
  const id = (widget.id || 'portfolio') + '-' + periodKey + (expanded ? '-expanded' : '-inline');
  return <div className={'fw-portfolio-view' + (expanded ? ' is-expanded' : '')}>
    <div className="fw-value-heading"><div><span>Valeur du portefeuille · {widget.currency}</span></div><div className="fw-total-value">{money(widget.totalValue, widget.currency)}</div></div>
    <div className="fw-change-row">{period.changeValue!==null&&<Delta value={period.changeValue} currency={widget.currency} />}{period.changePct!==null&&<Delta value={period.changePct} currency={widget.currency} kind="percent" />}<span className="fw-asof">{Number.isFinite(Date.parse(widget.asOf)) ? "Au " + dateLabel(widget.asOf) : "Date non fournie"}</span></div>
    <Unavailable period={period} title="Historique de valeur indisponible" fallback={rows.length > 1 ? <div className="fw-chart-wrap">
      <ChartContainer config={{ value: { label: 'Valeur observée', color: '#2864e8' }, reference: { label: 'Valeur au début de la période', color: '#9daec4' } }} className="fw-chart-container" style={{ height: expanded ? 380 : 110 }}>
        <AreaChart data={rows} margin={{ top: 18, right: 18, left: 8, bottom: 2 }} accessibilityLayer>
          <defs><linearGradient id={'fw-portfolio-fill-' + id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2864e8" stopOpacity={0.25} /><stop offset="100%" stopColor="#2864e8" stopOpacity={0.025} /></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="#dfe8f5" strokeDasharray="3 4" />
          <XAxis dataKey="date" tickFormatter={shortDate} axisLine={false} tickLine={false} minTickGap={36} tick={{ fill: '#697d98', fontSize: 11 }} />
          <YAxis domain={["dataMin - 1000", "dataMax + 1000"]} width={58} axisLine={false} tickLine={false} tick={{ fill: '#697d98', fontSize: 10 }} tickFormatter={(value) => new Intl.NumberFormat('fr-CA', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} />
          <ReferenceLine y={rows[0]?.reference} stroke="#91a4bb" strokeDasharray="4 4" />
          <Tooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload?.[0]?.payload?.date ? dateLabel(String(payload[0].payload.date)) : ''} formatter={(value, name) => <span className="fw-tooltip-row"><i style={{ backgroundColor: name === 'reference' ? '#91a4bb' : '#2864e8' }} />{name === 'reference' ? 'Valeur au début de la période' : 'Valeur observée'}<strong>{money(Number(value), widget.currency)}</strong></span>} />} />
          <Area type="monotone" dataKey="value" stroke="#2864e8" strokeWidth={2.5} fill={'url(#fw-portfolio-fill-' + id + ')'} activeDot={{ r: 5, strokeWidth: 2, fill: '#fff' }} isAnimationActive={!reduced} />
        </AreaChart>
      </ChartContainer>
      <p className="fw-chart-reference-note">{period.start&&period.end?`Du ${dateLabel(period.start)} au ${dateLabel(period.end)}`:''}</p>
    </div> : null} />
    {expanded?<PositionRows widget={widget} period={period}/>:<div className="fw-position-summary" aria-label="Aperçu des positions">
      <div>{widget.positions.slice(0,3).map((position,index)=><span key={position.id}><i style={{background:COLORS[index%COLORS.length]}}/>{position.ticker||position.label.replace(/\s*\(fixture\)/g,'')} <strong>{position.weightPct.toLocaleString('fr-CA',{maximumFractionDigits:1})} %</strong></span>)}</div>
      <button type="button" onClick={onExpand}>Voir les {widget.positions.length} positions <span aria-hidden="true">↗</span></button>
    </div>}
  </div>;
}

function PositionRows({ widget, period, compact = false }: { widget: FinancialWidgetData; period: FinancialWidgetPeriod; compact?: boolean }) {
  const [selected,setSelected]=useState<string|null>(null);
  const active=widget.positions.find(position=>position.id===selected);
  const changes = new Map(period.positions.map((entry) => [entry.id, entry]));
  return <div className={'fw-position-table' + (compact ? ' is-compact' : '')}>
    <div className="fw-position-head"><span>Titre</span><span>Part</span><span>Variation</span><span aria-hidden="true" /></div>
    {widget.positions.length ? widget.positions.map((position, index) => {
      const change = changes.get(position.id);
      return <button type="button" className="fw-position-row" key={position.id} aria-pressed={selected===position.id} onClick={()=>setSelected(current=>current===position.id?null:position.id)}>
        <span className="fw-position-name"><i style={{ background: COLORS[index % COLORS.length] }} /><span><strong>{position.ticker || position.label.replace(/\s*\(fixture\)/g,'')}</strong>{!compact && position.ticker && <small>{position.label}</small>}</span></span>
        <span>{position.weightPct.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} %</span>
        <span className="fw-position-delta"><Delta value={change?.changeValue ?? null} currency={widget.currency} /></span><span className="fw-position-chevron" aria-hidden="true">›</span>
      </button>;
    }) : <p className="fw-empty-inline">Aucune position n’est fournie pour ce compte.</p>}
    {active&&<div className="fw-position-inspect"><strong>{active.label.replace(/\s*\(fixture\)/g,'')}</strong><span>{money(active.value,widget.currency)} · {active.weightPct.toLocaleString('fr-CA',{maximumFractionDigits:1})} % du portefeuille</span><span>{active.sector??'Secteur non renseigné'}</span></div>}
  </div>;
}

function HeatmapView({ widget, period, expanded = false }: { widget: FinancialWidgetData; period: FinancialWidgetPeriod; expanded?: boolean }) {
  const [metric, setMetric] = useState<'variation' | 'amount'>('variation');
  const changes = new Map(period.positions.map((item) => [item.id, item]));
  const tiles: PositionTile[] = widget.positions.map((position) => ({ symbol: position.ticker || position.label, label: position.label, value: position.value, changePct: changes.get(position.id)?.changePct ?? null }));
  return <div className={'fw-heatmap-view' + (expanded ? ' is-expanded' : '')}>
    <div className="fw-section-toolbar"><div><h3>Mes positions</h3><p>La surface représente la valeur détenue.</p></div><div className="fw-segmented" role="group" aria-label="Valeur affichée dans les tuiles"><button type="button" aria-pressed={metric === 'variation'} onClick={() => setMetric('variation')}>Variation</button><button type="button" aria-pressed={metric === 'amount'} onClick={() => setMetric('amount')}>Montant</button></div></div>
    <div className="fw-heatmap-area">
      <PositionHeatmap data={tiles} formatValue={(value) => money(value, widget.currency)} unavailableLabel="Variation indisponible" className="fw-position-heatmap" height={expanded?440:180} metric={metric} />
      {metric === 'amount' && <div className="fw-heatmap-values" aria-label="Valeur des positions">{widget.positions.map((position) => <span key={position.id}><strong>{position.ticker || position.label.replace(/\s*\(fixture\)/g,'')}</strong>{money(position.value, widget.currency)}</span>)}</div>}
      {period.status !== 'ready' && <div className="fw-heatmap-period-note" role="status"><Info size={14} />{period.reason || 'Les valeurs des positions sont disponibles; leur variation pour cette période ne l’est pas.'}</div>}
    </div>
    <div className="fw-heatmap-today"><span>Variation de la période</span><Delta value={metric === 'amount' ? period.changeValue : period.changePct} currency={widget.currency} kind={metric === 'amount' ? 'money' : 'percent'} /></div>
  </div>;
}

function AllocationView({ widget, expanded = false }: { widget: FinancialWidgetData; expanded?: boolean }) {
  const reduced=useReducedMotion();
  const [grouping, setGrouping] = useState<'positions' | 'sectors'>('positions');
  const [selected, setSelected] = useState<string | null>(null);
  const rows = useMemo(() => grouping === 'positions' ? widget.positions.map((item, index) => ({ id: item.id, label: item.ticker || item.label, value: item.value, weightPct: item.weightPct, color: COLORS[index % COLORS.length], tickers: item.ticker ? [item.ticker] : [] })) : widget.sectors.map((item, index) => ({ id: item.id, label: item.label, value: item.value, weightPct: item.weightPct, color: COLORS[index % COLORS.length], tickers: widget.positions.filter((position) => position.sector === item.label && position.ticker).map((position) => position.ticker as string) })), [widget, grouping]);
  useEffect(() => { if (selected&&!rows.some((row) => row.id === selected)) setSelected(null); }, [rows, selected]);
  const active = rows.find((row) => row.id === selected);
  const availableSectors = widget.sectors.length > 0;
  return <div className={'fw-allocation-view' + (expanded ? ' is-expanded' : '')}>
    <div className="fw-section-toolbar"><div><h3>Où est mon argent&nbsp;?</h3><p>Répartition selon les positions reçues.</p></div><div className="fw-segmented" role="group" aria-label="Regrouper l’allocation"><button type="button" aria-pressed={grouping === 'positions'} onClick={() => setGrouping('positions')}>Par actif</button><button type="button" aria-pressed={grouping === 'sectors'} onClick={() => setGrouping('sectors')} disabled={!availableSectors}>Par secteur</button></div></div>
    {grouping === 'sectors' && !availableSectors ? <div className="fw-unavailable" role="status"><span className="fw-unavailable-icon"><Info size={18} /></span><div><strong>Répartition sectorielle non disponible</strong><p>Aucun secteur explicite n’est fourni. Les catégories de positions restent consultables par actif.</p></div></div> : <div className="fw-allocation-main">
      <div className="fw-donut-wrap"><ChartContainer config={Object.fromEntries(rows.map((row) => [row.id, { label: row.label, color: row.color }]))} className="fw-donut-chart" style={{ height: expanded ? 370 : 158 }}>
        <PieChart accessibilityLayer><Pie data={rows} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="90%" paddingAngle={1} stroke="#fff" strokeWidth={2} isAnimationActive={!reduced}>{rows.map((row) => <Cell key={row.id} fill={row.color} opacity={1} onClick={() => setSelected(row.id)} />)}<Label position="center" content={<text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" className="fw-donut-center-value">{new Intl.NumberFormat('fr-CA', { notation: 'compact', maximumFractionDigits: 1 }).format(widget.totalValue)}<tspan x="50%" dy="1.6em" className="fw-donut-center-currency">{widget.currency}</tspan></text>} /></Pie>
          <Tooltip content={<ChartTooltipContent formatter={(value, name) => <span className="fw-tooltip-row"><i style={{ backgroundColor: rows.find((row) => row.label === name)?.color }} />{String(name)}<strong>{money(Number(value), widget.currency)}</strong></span>} />} />

        </PieChart>
      </ChartContainer></div>
      <div className="fw-allocation-legend" role="list" aria-label="Détail de la répartition">{rows.map((row) => <button key={row.id} type="button" role="listitem" className={selected === row.id ? 'is-selected' : ''} onClick={() => setSelected(row.id)} aria-pressed={selected === row.id}><i style={{ backgroundColor: row.color }} /><strong>{row.label}</strong><span>{row.weightPct.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} %</span><b>{money(row.value, widget.currency)}</b></button>)}</div>
    </div>}
    {active && <div className="fw-allocation-selection"><div className="fw-selected-total"><i style={{ background: active.color }} /><span><small>{grouping === 'sectors' ? 'Secteur sélectionné' : 'Actif sélectionné'}</small><strong>{active.label}</strong><b>{money(active.value, widget.currency)}</b></span></div><div className="fw-ticker-chips">{active.tickers.length ? active.tickers.map((ticker) => <span key={ticker}>{ticker}</span>) : <span>{active.weightPct.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} % du portefeuille</span>}</div></div>}
  </div>;
}

function ContributionValue({x,y,width,height,value,currency,metric}: {x?:number|string;y?:number|string;width?:number|string;height?:number|string;value?:unknown;currency:string;metric:'money'|'percent'}) {
  const amount=Number(value); if(!Number.isFinite(amount))return null;
  return <text x={amount<0?Math.min(Number(x),Number(x)+Number(width))-8:Math.max(Number(x),Number(x)+Number(width))+8} y={Number(y)+Number(height)/2} textAnchor={amount<0?'end':'start'} dominantBaseline="middle" fill={amount<0?'#bf4354':'#087f66'} fontSize={12} fontWeight={650}>{metric==='money'?signedMoney(amount,currency):signedPct(amount).replace(' %',' pts')}</text>;
}

function ContributionBars({ widget, period, metric, expanded = false }: { widget: FinancialWidgetData; period: FinancialWidgetPeriod; metric: 'money' | 'percent'; expanded?: boolean }) {
  const reduced=useReducedMotion();
  const periodPositions = new Map(period.positions.map((item) => [item.id, item]));
  const rows = widget.positions.map((position, index) => {
    const change = periodPositions.get(position.id);
    const monetaryValue = change?.changeBasis === 'adjusted_price_history' ? null : change?.changeValue ?? null;
    return { id: position.id, label: position.ticker || position.label, value: metric === 'money' ? monetaryValue : change?.contributionPct ?? null, color: COLORS[index % COLORS.length] };
  }).filter((row) => row.value !== null).sort((a, b) => Math.abs(b.value ?? 0) - Math.abs(a.value ?? 0));
  const maximum = Math.max(1, ...rows.map((row) => Math.abs(row.value ?? 0)));
  if (period.status === 'unavailable' || rows.length === 0) return <Unavailable period={{ ...period, status: 'unavailable', reason: period.reason || 'Aucune variation attribuable par position n’est fournie pour cette période.' }} title="Variations par position indisponibles" />;
  return <ChartContainer config={{ value: { label: metric === 'money' ? 'Variation attribuée' : 'Contribution à la variation', color: '#16a6b5' } }} className={'fw-contribution-chart' + (expanded ? ' is-expanded' : '')} style={{ height: expanded ? 360 : Math.max(120, rows.length * 24 + 24) }}>
    <BarChart data={rows} layout="vertical" margin={{ top: 6, right: 105, left: 4, bottom: 6 }} accessibilityLayer><CartesianGrid horizontal={false} stroke="#e5ebf2" />
      <XAxis type="number" domain={[-maximum * 1.65, maximum * 1.65]} tickLine={false} axisLine={false} tick={{ fill: '#73849d', fontSize: 11 }} tickFormatter={(value) => metric === 'money' ? money(Number(value), widget.currency) : Number(value).toLocaleString('fr-CA', { maximumFractionDigits: 1 }) + ' pts'} />
      <YAxis type="category" dataKey="label" width={78} tickLine={false} axisLine={false} tick={{ fill: '#203b61', fontSize: 13, fontWeight: 600 }} /><ReferenceLine x={0} stroke="#93a5bb" />
      <Tooltip cursor={{ fill: '#eef4fc' }} content={<ChartTooltipContent formatter={(value, _name, item) => <span className="fw-tooltip-row"><i style={{ backgroundColor: item.payload.color }} />{String(item.payload.label)}<strong>{metric === 'money' ? signedMoney(Number(value), widget.currency) : signedPct(Number(value)).replace(' %',' pts')}</strong></span>} />} />
      <Bar dataKey="value" radius={[5, 5, 5, 5]} isAnimationActive={!reduced}>{rows.map((row) => <Cell key={row.id} fill={(row.value ?? 0) < 0 ? '#e96e75' : '#18b6a5'} />)}<LabelList dataKey="value" content={<ContributionValue currency={widget.currency} metric={metric}/>} /></Bar>
    </BarChart>
  </ChartContainer>;
}

function ContributionsView({ widget, periodKey, period, expanded = false }: { widget: FinancialWidgetData; periodKey: WidgetPeriodKey; period: FinancialWidgetPeriod; expanded?: boolean }) {
  const [metric, setMetric] = useState<'money' | 'percent'>('money');
  const hasContribution = period.positions.some((position) => position.contributionPct !== null);
  return <div className={'fw-contributions-view' + (expanded ? ' is-expanded' : '')}>
    <div className="fw-section-toolbar"><div><h3>Ce qui fait varier mon portefeuille</h3><p>{PERIOD_LABELS[periodKey]} · {widget.currency}</p></div><div className="fw-segmented" role="group" aria-label="Unité des contributions"><button type="button" aria-pressed={metric === 'money'} onClick={() => setMetric('money')}>En dollars</button><button type="button" aria-pressed={metric === 'percent'} onClick={() => setMetric('percent')} disabled={!hasContribution}>En points</button></div></div>
    <div className="fw-contribution-total"><div><strong><Delta value={metric === 'money' ? period.changeValue : period.changePct} currency={widget.currency} kind={metric === 'money' ? 'money' : 'percent'} /></strong><span>{PERIOD_LABELS[periodKey]}</span></div><ContributionBars widget={widget} period={period} metric={metric} expanded={expanded} /></div>
    {period.positions.some((position) => position.changeBasis === 'adjusted_price_history') && <p className="fw-change-note">Les variations de cours ajustés ne sont pas des contributions monétaires au portefeuille.</p>}
  </div>;
}

function SectorView({ widget, periodKey, period, expanded = false }: { widget: FinancialWidgetData; periodKey: WidgetPeriodKey; period: FinancialWidgetPeriod; expanded?: boolean }) {
  const changes = new Map(period.sectors.map((item) => [item.id, item]));
  const rows = widget.sectors.map((sector) => ({ ...sector, change: changes.get(sector.id) }));
  const maximum = Math.max(1, ...rows.map((row) => Math.abs(row.change?.changePct ?? 0)));
  const available = rows.some((row) => row.change?.changePct !== null && row.change?.changePct !== undefined);
  return <div className={'fw-sector-view' + (expanded ? ' is-expanded' : '')}><div className="fw-section-toolbar"><div><h3>Variation par secteur</h3><p>Secteurs explicitement associés aux positions.</p></div><span className="fw-period-label">{PERIOD_LABELS[periodKey]}</span></div>
    {!available ? <div className="fw-unavailable" role="status"><span className="fw-unavailable-icon"><Layers3 size={18} /></span><div><strong>Secteurs non disponibles pour cette période</strong><p>{period.reason || 'Aucune variation sectorielle attribuée n’est fournie.'}</p></div></div> : <div className="fw-sector-list">{rows.map((row, index) => <div className="fw-sector-row" key={row.id}><span><i style={{ background: COLORS[index % COLORS.length] }} /><strong>{row.label}</strong></span><div className="fw-sector-track"><i className={(row.change?.changePct ?? 0) < 0 ? 'is-negative' : ''} style={{ width: Math.min(100, Math.abs(row.change?.changePct ?? 0) / maximum * 100) + '%' }} /></div><Delta value={row.change?.changePct ?? null} currency={widget.currency} kind="percent" /><small>{money(row.value, widget.currency)} · {row.weightPct.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} %</small></div>)}</div>}
  </div>;
}

function WidgetContent({ widget, periodKey, expanded = false, onExpand }: { widget: FinancialWidgetData; periodKey: WidgetPeriodKey; expanded?: boolean;onExpand?:()=>void }) {
  const period = widget.periods[periodKey];
  if (widget.view === 'portfolio') return <PortfolioView widget={widget} periodKey={periodKey} period={period} expanded={expanded} onExpand={onExpand} />;
  if (widget.view === 'heatmap') return <HeatmapView widget={widget} period={period} expanded={expanded} />;
  if (widget.view === 'allocation') return <AllocationView widget={widget} expanded={expanded} />;
  if (widget.view === 'contributions') return <ContributionsView widget={widget} periodKey={periodKey} period={period} expanded={expanded} />;
  return <SectorView widget={widget} periodKey={periodKey} period={period} expanded={expanded} />;
}

export function FinancialWidget({ widget,onPeriodChange }: { widget: FinancialWidgetData;onPeriodChange?:(period:WidgetPeriodKey)=>void }) {
  const reduced = useReducedMotion();
  const [periodKey, setPeriodKey] = useState<WidgetPeriodKey>(widget.period);
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => setPeriodKey(widget.period), [widget.id, widget.period]);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (expanded && !element.open) element.showModal();
    if (!expanded && element.open) element.close();
  }, [expanded]);
  const id = widget.id || widget.view;
  return <>
    <motion.section className={'financial-widget fw-view-' + widget.view} aria-labelledby={'fw-title-' + id} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.22 }}>
      <header className="fw-widget-header"><div><h2 id={'fw-title-' + id}>{widget.title}</h2><p>{widget.portfolioName}</p></div><div className="fw-header-actions"><PeriodControls period={periodKey} onChange={next=>{setPeriodKey(next);onPeriodChange?.(next);}} /><button type="button" className="fw-expand-button" onClick={() => setExpanded(true)} aria-label={'Agrandir ' + widget.title}><Expand size={16} /></button></div></header>
      <div className="fw-widget-body"><WidgetContent widget={widget} periodKey={periodKey} onExpand={()=>setExpanded(true)}/></div>
      <footer className="fw-widget-footer"><span>{widget.periods[periodKey].status === 'partial' ? 'Données partielles' : widget.periods[periodKey].status === 'unavailable' ? 'Données indisponibles' : Number.isFinite(Date.parse(widget.asOf)) ? 'Données au ' + dateLabel(widget.asOf) : 'Portefeuille fictif · date non fournie'}</span><SummaryMeta widget={widget} /></footer>
    </motion.section>
    <dialog ref={dialog} className="fw-widget-dialog" aria-labelledby={'fw-dialog-title-' + id} onClose={() => setExpanded(false)} onClick={(event) => { if (event.target === event.currentTarget) setExpanded(false); }}>
      <div className="fw-dialog-header"><div><h2 id={'fw-dialog-title-' + id}>{widget.title}</h2><p>{widget.portfolioName} · {dateLabel(widget.asOf)}</p></div><button type="button" onClick={() => setExpanded(false)} aria-label="Fermer le détail"><X size={18} /></button></div>
      <div className="fw-dialog-content"><WidgetContent widget={widget} periodKey={periodKey} expanded /></div>
    </dialog>
  </>;
}

