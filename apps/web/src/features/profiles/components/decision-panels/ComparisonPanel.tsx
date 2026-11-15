import { useMemo } from 'react';
import { CalendarDays, Database, ExternalLink, Info } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { safeSourceUrl } from '../../profile-api';
import { ChartContainer, ChartTooltipContent } from '../financial-widgets/chart/recharts-chart-kit';
import type { ComparisonData } from './decision-data';
import './comparison-panel.css';

const COLORS = ['#3569df', '#159d94', '#c28b3f', '#8863ce', '#d25e77', '#548b62'];
const pct = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toLocaleString('fr-CA', { maximumFractionDigits: 2 })} %`;
const dateLong = (value: string) => new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
const dateShort = (value: string) => new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(value));
const dateTime = (value: string) => new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value));

export function ComparisonPanel({ data }: { data: ComparisonData }) {
  const palette = useMemo(() => new Map(data.metrics.map((metric, index) => [metric.ticker, COLORS[index % COLORS.length]])), [data.metrics]);
  const chartRows = useMemo(() => data.series.flatMap((row) => {
    if (typeof row.date !== 'string' || !Number.isFinite(Date.parse(row.date))) return [];
    const normalized: Record<string, string | number> = { date: row.date };
    for (const metric of data.metrics) {
      const value = row[metric.ticker];
      if (typeof value === 'number' && Number.isFinite(value)) normalized[metric.ticker] = value - 100;
    }
    return [normalized];
  }), [data.series, data.metrics]);

  return <article className="comparison-panel" aria-labelledby="comparison-panel-title">
    <header className="cp-header">
      <div><h2 id="comparison-panel-title">{data.title}</h2><p>{data.metrics.map((metric) => metric.ticker).join(' · ')}</p></div>
      <div className="cp-window"><CalendarDays size={14} aria-hidden="true" /><span>{dateShort(data.period.from)} – {dateShort(data.period.to)}</span></div>
    </header>

    <div className="cp-meta-row" aria-label="Périmètre des données">
      <span><strong>{data.observations.toLocaleString('fr-CA')}</strong> dates communes</span>
      <span>{data.currency}</span>
      <span>Historique ajusté</span>
    </div>

    <section className="cp-chart-section" aria-labelledby="cp-chart-title">
      <div className="cp-section-heading"><div><h3 id="cp-chart-title">Rendement cumulatif depuis le début</h3><p>Variation relative sur la période commune</p></div><span>en %</span></div>
      {chartRows.length > 1 && data.metrics.length > 0 ? <ChartContainer
        config={Object.fromEntries(data.metrics.map((metric) => [metric.ticker, { label: metric.ticker, color: palette.get(metric.ticker)! }]))}
        className="cp-chart"
        style={{ height: 238 }}
      >
        <LineChart data={chartRows} margin={{ top: 12, right: 12, left: -17, bottom: 4 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="#e7edf6" strokeDasharray="3 4" />
          <XAxis dataKey="date" tickFormatter={(value) => dateShort(String(value))} minTickGap={38} axisLine={false} tickLine={false} tick={{ fill: '#71819b', fontSize: 10 }} />
          <YAxis width={54} tickFormatter={(value) => `${Number(value).toLocaleString('fr-CA', { maximumFractionDigits: 1 })} %`} axisLine={false} tickLine={false} tick={{ fill: '#71819b', fontSize: 10 }} />
          <ReferenceLine y={0} stroke="#9cacc1" strokeDasharray="4 4" />
          <Tooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload?.[0]?.payload?.date ? dateLong(String(payload[0].payload.date)) : ''} formatter={(value, name) => <span className="cp-tooltip-row"><i style={{ background: palette.get(String(name)) }} />{String(name)}<strong>{pct(Number(value))}</strong></span>} />} />
          {data.metrics.map((metric) => <Line key={metric.ticker} dataKey={metric.ticker} name={metric.ticker} type="monotone" stroke={palette.get(metric.ticker)} strokeWidth={2.25} dot={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />)}
        </LineChart>
      </ChartContainer> : <p className="cp-empty-chart" role="status">Pas assez de dates valides pour tracer cette comparaison.</p>}
      <div className="cp-legend" role="list" aria-label="Actifs comparés">{data.metrics.map((metric) => <span role="listitem" key={metric.ticker}><i style={{ background: palette.get(metric.ticker) }} /><strong>{metric.ticker}</strong><span>{metric.name}</span></span>)}</div>
    </section>

    <section className="cp-results" aria-labelledby="cp-results-title">
      <div className="cp-section-heading"><div><h3 id="cp-results-title">Mesures observées</h3><p>Calculées sur les mêmes dates</p></div></div>
      <div className="cp-metric-table" role="table" aria-label="Mesures comparées">
        <div className="cp-metric-head" role="row"><span role="columnheader">Actif</span><span role="columnheader">Rendement total</span><span role="columnheader">Variabilité*</span><span role="columnheader">Repli maximal</span></div>
        {data.metrics.map((metric) => <div className="cp-metric-row" role="row" key={metric.ticker}>
          <span className="cp-asset" role="rowheader"><i style={{ background: palette.get(metric.ticker) }} /><span><strong>{metric.ticker}</strong><small>{metric.name}</small></span></span>
          <strong className={metric.returnPct >= 0 ? 'is-up' : 'is-down'} role="cell">{pct(metric.returnPct)}</strong>
          <strong role="cell">{pct(metric.periodVolatilityPct)}</strong>
          <strong className="is-down" role="cell">{pct(metric.drawdownPct)}</strong>
        </div>)}
      </div>
      <p className="cp-observation-note">* Écart-type des rendements observés, non annualisé. Les observations exclues sont indiquées par actif.</p>
      {data.metrics.some((metric) => metric.excludedObservations > 0) && <div className="cp-exclusions">{data.metrics.filter((metric) => metric.excludedObservations > 0).map((metric) => <span key={metric.ticker}>{metric.ticker} : {metric.excludedObservations} observation(s) hors dates communes</span>)}</div>}
    </section>

    <details className="cp-provenance">
      <summary><Info size={14} aria-hidden="true" /> Sources, méthode et limites</summary>
      <div className="cp-provenance-content">
        <p><Database size={14} aria-hidden="true" /><span>{data.methodDetails}</span></p>
        <p>Fenêtre observée : {dateLong(data.period.from)} au {dateLong(data.period.to)} · {data.observations} dates communes · devise {data.currency}.</p>
        <p>Calcul effectué le {dateTime(data.createdAt)}. Empreinte des données : <code>{data.dataSha256}</code></p>
        <ul>{data.limits.map((limit) => <li key={limit}>{limit}</li>)}</ul>
        <div className="cp-sources" aria-label="Sources par actif">{data.metrics.map((metric) => {
          const url = safeSourceUrl(metric.sourceUrl);
          return url === '#' ? <p key={metric.ticker}>{metric.ticker} · {metric.source} — lien indisponible</p> : <a key={metric.ticker} href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} aria-hidden="true" /><span><strong>{metric.ticker} · {metric.source}</strong><small>{metric.classification}{metric.sourceAsOf ? ` · données au ${dateLong(metric.sourceAsOf)}` : ''}{metric.sourceDescription ? ` · ${metric.sourceDescription}` : ''}</small></span></a>;
        })}</div>
      </div>
    </details>
  </article>;
}
