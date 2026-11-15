import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, ChevronDown, LoaderCircle, Newspaper, RefreshCw, TrendingUp } from 'lucide-react';
import { loadSimulationHistory, loadSimulationNews, runAnalysisForecast, type SimulationHistory, type SimulationNews, type SimulationProjection } from '../../shared/api';
import { MarketTimelineChart, forecastColors, type TimelinePrice, type TimelineMarker } from './MarketTimelineChart';
import { EventVisual, eventCategory } from './EventVisual';
import { SourceDetailsButton } from './SourceDetailsButton';
import { MarketMovesPanel, movementTarget, useMarketMoves, type MovementResearchContext } from './MarketMoves';
import { timelineMarkerPlacement } from './timeline-marker-placement';
import { dateStamp, fullDate, moneyLabel, numberLabel, preciseDate, sourceUrl } from './presentation';
import type { ExploreHandler, ExplorationTarget } from './types';
import './history-explorer.css';

export type HistoryRange = '1M' | '3M' | '6M' | '1A' | 'Tout';
export type HistoryConfiguration = { range: HistoryRange; showVolume: boolean; showEvents: boolean };
const ranges: HistoryRange[] = ['1M', '3M', '6M', '1A', 'Tout'];
const emptyEvents: ExplorationTarget[] = [];
type Props = {
  ticker: string; onExplore: ExploreHandler; onTargets?: (targets: ExplorationTarget[]) => void;
  dataOverride?: SimulationHistory; initialRange?: HistoryRange; initialShowVolume?: boolean; initialShowEvents?: boolean;
  configuration?: HistoryConfiguration; onConfigurationChange?: (next: HistoryConfiguration) => void;
  configurationBusy?: boolean; allowNews?: boolean; researchEvents?: ExplorationTarget[];
  projection?: SimulationProjection; enableForecast?: boolean; onForecast?: (result: SimulationProjection) => void;
  onSimulation?: () => void; analysis?: ExplorationTarget; researchContext?: MovementResearchContext;
};
export function HistoryExplorer({ ticker, onExplore, onTargets, dataOverride, initialRange = '3M', initialShowVolume = true, initialShowEvents = true, configuration, onConfigurationChange, configurationBusy = false, allowNews = true, researchEvents = emptyEvents, projection, enableForecast = false, onForecast, onSimulation, analysis, researchContext }: Props) {
  const [history, setHistory] = useState<SimulationHistory>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [localConfiguration, setConfiguration] = useState<HistoryConfiguration>({ range: initialRange, showVolume: initialShowVolume, showEvents: initialShowEvents });
  const { range, showVolume, showEvents } = configuration || localConfiguration;
  const [showPrice, setShowPrice] = useState(true);
  const [showMoves, setShowMoves] = useState(true);
  const [moveThreshold, setMoveThreshold] = useState(3);
  const [showForecast, setShowForecast] = useState(true);
  const [selected, setSelected] = useState(0);
  const [news, setNews] = useState<SimulationNews>();
  const [newsBusy, setNewsBusy] = useState(false);
  const [newsError, setNewsError] = useState('');
  const [newsExpanded, setNewsExpanded] = useState(false);
  const [localProjection, setProjection] = useState<SimulationProjection>();
  const [forecastError, setForecastError] = useState('');
  const [forecastBusy, setForecastBusy] = useState(false);
  const newsAbort = useRef<AbortController | null>(null);
  const forecastCallback = useRef(onForecast); forecastCallback.current = onForecast;
  const reducedMotion = useReducedMotion() || false;
  const symbol = ticker.trim().toUpperCase();
  const changeConfiguration = (patch: Partial<HistoryConfiguration>) => {
    const next = { range, showVolume, showEvents, ...patch };
    if (configuration) onConfigurationChange?.(next); else setConfiguration(next);
  };
  useEffect(() => {
    const controller = new AbortController();
    setHistory(undefined); setError(''); setLoading(true); setSelected(0);
    const request = dataOverride ? Promise.resolve(dataOverride) : loadSimulationHistory(symbol, controller.signal);
    request.then(result => {
      if (controller.signal.aborted) return;
      if (!result?.asset || result.asset.ticker.toUpperCase() !== symbol || !Array.isArray(result.prices) || !Array.isArray(result.events) || !Array.isArray(result.limitations) || !Number.isFinite(dateStamp(result.sourceAsOf)) || !/^[A-Z]{3}$/.test(result.currency)) throw new Error('Le jeu historique reçu est incomplet ou ne correspond pas au titre.');
      setHistory(result);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Historique indisponible.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [symbol, reload, dataOverride]);
  useEffect(() => {
    if (!enableForecast || dataOverride || projection) return;
    const controller = new AbortController(); setProjection(undefined); setForecastError(''); setForecastBusy(true);
    runAnalysisForecast({ ticker: symbol, horizonObservations: 5, branches: [{ id: 'reference', title: 'Référence estimée', event: 'Aucun choc ajouté', shockPct: 0, eventAfterObservations: 0 }] }, controller.signal).then(result => {
      if (!controller.signal.aborted) { setProjection(result); forecastCallback.current?.(result); }
    }).catch(cause => { if (!controller.signal.aborted) setForecastError(cause instanceof Error ? cause.message : 'Estimation indisponible.'); }).finally(() => { if (!controller.signal.aborted) setForecastBusy(false); });
    return () => controller.abort();
  }, [symbol, enableForecast, dataOverride, projection]);
  const loadNews = async () => {
    newsAbort.current?.abort(); const controller = new AbortController(); newsAbort.current = controller;
    setNewsBusy(true); setNewsError('');
    try {
      const result = await loadSimulationNews(symbol, controller.signal);
      if (controller.signal.aborted) return;
      if (result.ticker.toUpperCase() !== symbol || !Array.isArray(result.articles)) throw new Error('Actualités reçues pour un autre titre.');
      setNews({ ...result, articles: result.articles.filter(article => article && ['id', 'title', 'url', 'domain', 'indexedAt'].every(key => typeof article[key as keyof typeof article] === 'string')) });
    } catch (cause) { if (!controller.signal.aborted) setNewsError(cause instanceof Error ? cause.message : 'Actualités indisponibles.'); }
    finally { if (!controller.signal.aborted) setNewsBusy(false); }
  };
  useEffect(() => {
    setNews(undefined); setNewsExpanded(false);
    if (allowNews && !dataOverride) void loadNews();
    return () => newsAbort.current?.abort();
  }, [symbol, allowNews, dataOverride]);
  const rows = useMemo<TimelinePrice[]>(() => history?.prices.filter(point => Number.isFinite(dateStamp(point.date)) && Number.isFinite(point.adjustedClose) && point.adjustedClose > 0).map(point => ({ date: point.date, timestamp: dateStamp(point.date), adjustedClose: point.adjustedClose, volume: Number.isFinite(point.volume) && point.volume >= 0 ? point.volume : undefined })).sort((a, b) => a.timestamp - b.timestamp) || [], [history]);
  const visible = useMemo(() => {
    if (range === 'Tout' || !rows.length) return rows;
    const cutoff = new Date(rows.at(-1)!.timestamp); cutoff.setUTCMonth(cutoff.getUTCMonth() - ({ '1M': 1, '3M': 3, '6M': 6, '1A': 12 } as const)[range]);
    return rows.filter(point => point.timestamp >= cutoff.getTime());
  }, [rows, range]);
  useEffect(() => setSelected(Math.max(0, visible.length - 1)), [visible]);
  const classification = history?.sourceClassification === 'illustrative' ? 'illustrative' : 'historical';
  const source = history && sourceUrl(history.sourceUrl) ? { title: 'Cours historiques et événements d’entreprise', url: sourceUrl(history.sourceUrl)!, publisher: new URL(sourceUrl(history.sourceUrl)!).hostname.replace(/^www\./,'') } : undefined;
  const pointTarget = (point: TimelinePrice): ExplorationTarget => ({ id: `history:${symbol}:${point.date}`, kind: 'point', title: `${symbol} · clôture du ${fullDate(point.date)}`, ticker: symbol, date: point.date, classification, source, summary: 'Clôture ajustée du jeu historique disponible.', metrics: [{ label: 'Clôture ajustée', value: moneyLabel(point.adjustedClose, history!.currency) }, ...(point.volume === undefined ? [] : [{ label: 'Volume', value: numberLabel(point.volume) }])] });
  const corporateEvents = useMemo<ExplorationTarget[]>(() => history?.events.filter(event => Number.isFinite(dateStamp(event.date))).map(event => ({ id: `corporate:${event.id}`, kind: 'event', title: `${event.kind === 'dividend' ? 'Dividende' : ['split', 'stock_split'].includes(event.kind) ? 'Fractionnement' : event.kind} · ${symbol}`, ticker: symbol, date: event.date, classification, source, summary: `Événement d’entreprise fourni avec l’historique. Son rapprochement avec une clôture ne démontre pas de causalité.`, metrics: event.value === null ? [] : [{ label: 'Valeur déclarée', value: `${numberLabel(event.value)} ${event.unit || ''}`.trim() }] })) || [], [history, symbol]);
  const newsTargets = useMemo<ExplorationTarget[]>(() => news?.articles.map(article => ({ id: `news:${article.id}`, kind: 'event', title: article.title, ticker: symbol, date: article.indexedAt, dateKind:'indexed', dateLabel: `${preciseDate(article.indexedAt)} · indexation`, imageUrl: sourceUrl(article.imageUrl), classification: 'research', source: { title: article.title, url: sourceUrl(article.url) || '', publisher: article.domain }, summary: 'Article découvert dans la presse. L’heure fournie est une indexation, pas une date de publication confirmée. Le contenu et son lien avec le titre restent à vérifier.' })) || [], [news, symbol]);
  const editorial = useMemo(() => [...researchEvents, ...newsTargets].filter((item, index, list) => list.findIndex(other => other.source?.url === item.source?.url && other.title === item.title) === index), [researchEvents, newsTargets]);
  const movementResearch = useMarketMoves(researchContext, symbol, visible[0]?.date, visible.at(-1)?.date, moveThreshold);
  const movementTargets = useMemo(() => movementResearch.report?.movements.map(move => movementTarget(move, movementResearch.report!)) || [], [movementResearch.report]);
  const markers = useMemo<TimelineMarker[]>(() => [...(showEvents ? [...corporateEvents, ...editorial] : []), ...(showMoves ? movementTargets : [])].flatMap(target => {
    const placement = timelineMarkerPlacement(target, rows, history?.asset);
    if (!placement.date) return [];
    return [{ date: placement.date, target: placement.note ? { ...target, dateLabel: `${target.dateLabel || fullDate(target.date)} · ${placement.note}` } : target }];
  }), [corporateEvents, editorial, showEvents, showMoves, movementTargets, rows, history?.asset]);
  const upcoming = researchEvents.filter(event => event.dateKind === 'scheduled' && dateStamp(event.date) > (rows.at(-1)?.timestamp ?? Infinity));
  useEffect(() => onTargets?.([...corporateEvents, ...editorial, ...movementTargets]), [corporateEvents, editorial, movementTargets, onTargets]);
  const currentProjection = projection || localProjection;
  const chartProjection = showForecast && currentProjection?.ticker.toUpperCase() === symbol ? currentProjection : undefined;
  const active = visible[Math.min(selected, visible.length - 1)];
  const first = visible[0];
  const change = active && first ? (active.adjustedClose / first.adjustedClose - 1) * 100 : undefined;
  const shownEditorial = editorial.filter(target=>target.dateKind!=='scheduled').sort((a, b) => dateStamp(b.date) - dateStamp(a.date));
  const chartSources = history ? [{ id: `prices:${symbol}`, title: 'Cours ajustés et événements d’entreprise', publisher: history.source, url: source?.url, dateLabel: `Du ${fullDate(rows[0]?.date)} au ${fullDate(rows.at(-1)?.date)}`, excerpt: history.method, limits: history.limitations.join('\n') }] : [];
  return <section className="hx-root" aria-label={`Explorateur historique de ${symbol}`}>
    <header className="hx-header"><div><h3>{history?.asset.name || symbol} <span>{symbol} · {history?.currency || 'Cours ajustés'}</span></h3><p>Marché, annonces et trajectoires</p></div><div className="hx-header-actions">{analysis && <button type="button" onClick={() => onExplore(analysis)}><BookOpen size={14} />Lire l’analyse</button>}<SourceDetailsButton sources={chartSources} label="Données & méthode" /></div></header>
    {loading ? <p className="hx-status" role="status"><LoaderCircle size={16} className="hx-spin" />Chargement des cours…</p> : error ? <div className="hx-status" role="alert"><p>{error}</p><button type="button" onClick={() => setReload(value => value + 1)}>Réessayer</button></div> : history && visible.length ? <>
      <div className="hx-market-toolbar"><div className="hx-quote"><strong>{active && moneyLabel(active.adjustedClose, history.currency)}</strong>{change !== undefined && <span className={change >= 0 ? 'is-positive' : 'is-negative'}>{change >= 0 ? '+' : ''}{numberLabel(change)} % <small>sur la période</small></span>}<time dateTime={active?.date}>{fullDate(active?.date)} · clôture ajustée</time></div><div className="hx-ranges" role="group" aria-label="Période historique">{ranges.map(value => <button type="button" key={value} aria-pressed={range === value} disabled={configurationBusy} onClick={() => changeConfiguration({ range: value })}>{value}</button>)}</div></div>
      <div className="hx-chart-focus" role="group" tabIndex={0} aria-label="Historique interactif. Flèches gauche et droite : choisir une clôture; Entrée : ouvrir les détails." onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' '].includes(event.key)) { event.preventDefault(); if (event.key === 'Enter' || event.key === ' ') { if (active) onExplore(pointTarget(active)); } else setSelected(value => event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1 : Math.max(0, Math.min(visible.length - 1, value + (event.key === 'ArrowLeft' ? -1 : 1)))); }
      }}><MarketTimelineChart prices={visible} markers={markers} projection={chartProjection} showPrice={showPrice} showVolume={showVolume} onSelect={setSelected} onExplore={onExplore} currency={history.currency} analysis={analysis} reducedMotion={reducedMotion} priceSource={source} ticker={symbol} /></div>
      <div className="hx-legend" role="group" aria-label="Calques du graphique"><button type="button" aria-pressed={showPrice} onClick={() => setShowPrice(!showPrice)}><i className="hx-key-price" />Cours ajusté</button><button type="button" aria-pressed={showVolume} disabled={configurationBusy} onClick={() => changeConfiguration({ showVolume: !showVolume })}><i className="hx-key-volume" />Volumes</button><button type="button" aria-pressed={showEvents} disabled={configurationBusy} onClick={() => changeConfiguration({ showEvents: !showEvents })}><Newspaper size={13} />Événements & presse</button>{researchContext && <button type="button" aria-pressed={showMoves} onClick={() => setShowMoves(value => !value)}><TrendingUp size={13} />Variations importantes</button>}{enableForecast && <button type="button" aria-pressed={showForecast} onClick={() => setShowForecast(!showForecast)}><TrendingUp size={13} />Estimation p10–p90{forecastBusy && !currentProjection && <LoaderCircle size={12} className="hx-spin" />}</button>}</div>
      {researchContext && <MarketMovesPanel report={movementResearch.report} loading={movementResearch.loading} error={movementResearch.error} threshold={moveThreshold} onThreshold={setMoveThreshold} onRefresh={movementResearch.refresh} onExplore={onExplore}/>}
      {chartProjection && <div className="hx-forecast-summary"><TrendingUp size={18} /><div><strong>Trajectoires estimées · {chartProjection.timeUnit === 'calendar_days' ? `${chartProjection.horizonDays} jours` : `${chartProjection.horizonObservations} séances`}</strong><span>Départ au {fullDate(chartProjection.asOf)} · référence calculée depuis l’historique</span></div>{onSimulation && <button type="button" onClick={onSimulation}>Explorer les scénarios <ArrowUpRight size={14} /></button>}</div>}
      {chartProjection&&<div className="hx-forecast-branches" aria-label="Trajectoires affichées">{chartProjection.branches.map((branch,index)=><span key={branch.id}><i style={{background:forecastColors[index]}}/>{branch.title}<strong>{moneyLabel(branch.path.at(-1)!.medianPrice,chartProjection.currency)}</strong></span>)}</div>}
      {forecastError && <p className="hx-inline-notice" role="status">{forecastError} Les cours et événements restent accessibles.</p>}
      {chartProjection && chartProjection.asOf !== rows.at(-1)?.date && <p className="hx-inline-notice">L’estimation et l’historique ont des dates d’arrêt différentes. La courbe n’est pas raccordée aux cours.</p>}
      {upcoming.length > 0 && <section className="hx-upcoming" aria-label="Événements à venir"><header><h4><CalendarDays size={15} />Prochains rendez-vous</h4><span>Dates annoncées · résultats inconnus</span></header><div>{upcoming.slice(0, 6).map(target => <button type="button" key={target.id} onClick={() => onExplore(target)}><EventVisual target={target} /><span><time>{target.dateLabel || fullDate(target.date)}</time><strong>{target.title}</strong></span><ArrowUpRight size={14} /></button>)}</div></section>}
      <details className="hx-observations"><summary>Observations du graphique <span>{visible.length} clôtures · {fullDate(first?.date)} – {fullDate(visible.at(-1)?.date)}</span></summary><div className="hx-observation-toolbar"><span>Volume sélectionné : {active?.volume === undefined ? 'non fourni' : numberLabel(active.volume)}</span><div><button type="button" aria-label="Observation précédente" disabled={selected <= 0} onClick={() => setSelected(value => value - 1)}><ArrowLeft size={13} /></button><button type="button" onClick={() => active && onExplore(pointTarget(active))}>Explorer cette clôture</button><button type="button" aria-label="Observation suivante" disabled={selected >= visible.length - 1} onClick={() => setSelected(value => value + 1)}><ArrowRight size={13} /></button></div></div><div className="hx-data-scroll"><table><thead><tr><th>Date de clôture</th><th>Cours ajusté ({history.currency})</th><th>Volume</th></tr></thead><tbody>{visible.map(point => <tr key={point.date}><th><button type="button" onClick={() => onExplore(pointTarget(point))}>{fullDate(point.date)}</button></th><td>{moneyLabel(point.adjustedClose, history.currency)}</td><td>{point.volume === undefined ? '—' : numberLabel(point.volume)}</td></tr>)}</tbody></table></div></details>
    </> : <p className="hx-status">Aucune clôture disponible.</p>}
    {allowNews && <section className="hx-news" aria-label="Actualités et annonces"><header><div><h4><Newspaper size={16} />Actualités & annonces</h4><p>Communiqués de l’analyse et couverture de presse disponible.</p></div><button type="button" disabled={newsBusy} onClick={() => void loadNews()} aria-label="Actualiser les actualités">{newsBusy ? <LoaderCircle size={14} className="hx-spin" /> : <RefreshCw size={14} />}</button></header>
      <div className="hx-news-grid">{shownEditorial.slice(0, newsExpanded ? undefined : 4).map(target => <button type="button" key={target.id} onClick={() => onExplore(target)}><EventVisual target={target} className={target.imageUrl ? 'has-image' : ''} /><span><small>{eventCategory(target).label} · {target.source?.publisher}</small><strong>{target.title}</strong><time>{target.dateLabel || fullDate(target.date)}</time></span><ArrowUpRight size={14} /></button>)}</div>
      {shownEditorial.length > 4 && <button type="button" className="hx-more-news" onClick={() => setNewsExpanded(!newsExpanded)}>{newsExpanded ? 'Réduire les actualités' : `Voir les ${shownEditorial.length} actualités et annonces`}<ChevronDown size={13} /></button>}
      {!shownEditorial.length && !newsBusy && <p className="hx-inline-notice">{news?.reason || 'Aucun article disponible pour ce titre.'}</p>}
      {(newsError || news?.reason || news?.limitations?.length) && <details className="hx-feed-limits"><summary>Disponibilité et provenance de la presse</summary>{newsError && <p>{newsError}</p>}{news?.reason&&<p>{news.reason}</p>}{news?.limitations?.map((item, index) => <p key={index}>{item}</p>)}<p>L’heure d’indexation ne confirme pas la publication. Une image fournie peut être un visuel d’illustration. Aucun article ne détermine le choc d’un scénario.</p></details>}
    </section>}
  </section>;
}
