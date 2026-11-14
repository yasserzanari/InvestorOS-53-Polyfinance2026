import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays, Database, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { loadSimulationAssets, loadSimulationHistory, loadSimulationRegulations, type SimulationAssetList, type SimulationHistory, type SimulationRegulation, type SimulationRegulations } from '../../shared/api';
import './scenarios.css';

type Range = 1 | 3 | 5;
const RANGE_OPTIONS: Range[] = [1, 3, 5];
type Horizon = 20 | 60 | 120;
const HORIZONS: Horizon[] = [20, 60, 120];
const eventNames: Record<string, string> = { dividend: 'Dividende', split: 'Fractionnement', stock_split: 'Fractionnement' };
const dateLabel = (value: string) => new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
const pctLabel = (value: number | null | undefined) => value === null || value === undefined ? '—' : `${value > 0 ? '+' : ''}${value.toLocaleString('fr-CA', { maximumFractionDigits: 2 })} %`;
const quantile = (input: number[], fraction: number) => {
  if (!input.length) return undefined;
  const values = input.slice().sort((a, b) => a - b);
  const at = (values.length - 1) * fraction;
  const low = Math.floor(at);
  const blend = at - low;
  return values[low] + (values[Math.min(low + 1, values.length - 1)] - values[low]) * blend;
};
function returnsAfterDate(data: SimulationHistory, eventDate: string) {
  const index = data.prices.findIndex((point) => point.date >= eventDate);
  if (index < 0) return { '1': null, '5': null, '20': null };
  const base = data.prices[index].adjustedClose;
  return Object.fromEntries([1, 5, 20].map((horizon) => {
    const future = data.prices[index + horizon];
    return [String(horizon), future ? (future.adjustedClose / base - 1) * 100 : null];
  })) as Record<'1'|'5'|'20', number|null>;
}

function HistoricalChart({ data, regulations = [], selectedId, onSelect }: { data: SimulationHistory; regulations?: SimulationRegulation[]; selectedId?: string; onSelect: (id: string) => void }) {
  const [range, setRange] = useState<Range>(3);
  const [horizon, setHorizon] = useState<Horizon>(60);
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - range);
  const visible = data.prices.filter((point) => new Date(`${point.date}T00:00:00Z`) >= cutoff);
  const first = visible[0]?.adjustedClose ?? 1;
  const normalized = visible.map((point) => ({ ...point, value: point.adjustedClose / first * 100 }));
  const rollingReturns = visible.slice(horizon).map((point, index) => point.adjustedClose / visible[index].adjustedClose - 1);
  const lowerReturn = quantile(rollingReturns, .1);
  const medianReturn = quantile(rollingReturns, .5);
  const upperReturn = quantile(rollingReturns, .9);
  const currentIndex = normalized.at(-1)?.value ?? 100;
  const futureLow = lowerReturn === undefined ? undefined : currentIndex * (1 + lowerReturn);
  const futureMedian = medianReturn === undefined ? undefined : currentIndex * (1 + medianReturn);
  const futureHigh = upperReturn === undefined ? undefined : currentIndex * (1 + upperReturn);
  const values = normalized.map((point) => point.value);
  const min = Math.min(...values, 100, futureLow ?? Infinity);
  const max = Math.max(...values, 100, futureHigh ?? -Infinity);
  const padding = Math.max((max - min) * .12, 2);
  const low = min - padding;
  const high = max + padding;
  const yFor = (value: number) => 300 - (value - low) / (high - low) * 270;
  const xy = normalized.map((point, index) => ({
    x: normalized.length < 2 ? 0 : index / (normalized.length - 1) * 1000,
    y: yFor(point.value),
    ...point,
  }));
  const path = xy.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const currentY = xy.at(-1)?.y ?? yFor(100);
  const futureArea = futureLow !== undefined && futureHigh !== undefined ? `M1000 ${currentY} L1080 ${yFor(futureHigh)} L1080 ${yFor(futureLow)} Z` : '';
  const futureMedianPath = futureMedian !== undefined ? `M1000 ${currentY} L1080 ${yFor(futureMedian)}` : '';
  const shownEvents = data.events.filter((event) => event.date >= (visible[0]?.date ?? '') && event.date <= (visible.at(-1)?.date ?? ''));
  const shownRegulations = regulations.filter((event) => event.publishedAt >= (visible[0]?.date ?? '') && event.publishedAt <= (visible.at(-1)?.date ?? ''));
  const selected = data.events.find((event) => event.id === selectedId);
  const selectedRegulation = regulations.find((event) => `reg:${event.id}` === selectedId);
  const eventPosition = (eventDate: string) => {
    const index = xy.findIndex((point) => point.date >= eventDate);
    return index < 0 ? undefined : xy[index];
  };

  return (
    <>
      <section className="simulation-chart-card" aria-labelledby="simulation-chart-title">
        <div className="simulation-chart-heading">
          <div><span className="simulation-eyebrow"><Activity size={13} /> TRAJECTOIRE HISTORIQUE</span><h2 id="simulation-chart-title">{data.asset.name} <small>{data.asset.ticker}</small></h2></div>
          <div className="simulation-range" role="group" aria-label="Période du graphique">
            {RANGE_OPTIONS.map((years) => <button type="button" key={years} aria-pressed={range === years} onClick={() => setRange(years)}>{years} an{years > 1 ? 's' : ''}</button>)}
          </div>
        </div>
        <div className="simulation-chart-legend"><span><i /> Prix ajusté, base 100 au début de la période</span><span><b /> Événement daté</span><span><em /> Référence historique</span><span className="simulation-currency">{data.currency}</span></div>
        <div className="simulation-chart-plot" role="group" aria-label={`Historique de ${data.asset.name}, repères d’événements sélectionnables`}>
          <div className="simulation-y-labels"><span>{high.toFixed(0)}</span><span>{((high + low) / 2).toFixed(0)}</span><span>{low.toFixed(0)}</span></div>
          <svg viewBox="0 0 1100 320" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="simulation-gradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#4779d0" stopOpacity=".18" /><stop offset="100%" stopColor="#4779d0" stopOpacity="0" /></linearGradient></defs>
            {[30, 165, 300].map((y) => <line key={y} x1="0" x2="1000" y1={y} y2={y} className="simulation-grid-line" />)}
            <line x1="0" x2="1000" y1={yFor(100)} y2={yFor(100)} className="simulation-baseline" />
            <path d={`${path} L1000 320 L0 320 Z`} className="simulation-chart-area" />
            <path d={path} className="simulation-chart-line" />
            {futureArea && <path d={futureArea} className="simulation-future-band" />}
            {futureMedianPath && <path d={futureMedianPath} className="simulation-future-median" />}
          </svg>
          {shownEvents.map((event) => {
            const point = eventPosition(event.date);
            if (!point) return null;
            return <button key={event.id} type="button" className={`simulation-event-marker${selectedId === event.id ? ' is-selected' : ''}`} style={{ left: `${point.x / 11}%`, top: `${point.y / 3.2}%` }} aria-label={`${eventNames[event.kind] ?? event.kind}, ${dateLabel(event.date)}. Afficher les rendements observés`} aria-pressed={selectedId === event.id} onClick={() => onSelect(event.id)}><span /></button>;
          })}
          {shownRegulations.map((event) => {
            const point = eventPosition(event.publishedAt);
            if (!point) return null;
            return <button key={event.id} type="button" className={`simulation-event-marker is-regulation${selectedId === `reg:${event.id}` ? ' is-selected' : ''}`} style={{ left: `${point.x / 11}%`, top: `${point.y / 3.2}%` }} aria-label={`Document réglementaire, ${event.title}, publié le ${dateLabel(event.publishedAt)}. Afficher le contexte`} aria-pressed={selectedId === `reg:${event.id}`} onClick={() => onSelect(`reg:${event.id}`)}><span /></button>;
          })}
          {!normalized.length && <span className="simulation-chart-empty">Aucun cours sur cette période</span>}
        </div>
        <div className="simulation-x-labels"><span>{visible[0] ? dateLabel(visible[0].date) : ''}</span><span>{visible.at(-1) ? dateLabel(visible.at(-1)!.date) : ''}</span><span>+{horizon} séances</span></div>
        <div className="simulation-outlook"><div><span>Trajectoire de référence</span><strong>{horizon} séances</strong></div>
          <div className="simulation-horizons" role="group" aria-label="Horizon de la référence historique">{HORIZONS.map((value) => <button type="button" key={value} aria-pressed={horizon === value} onClick={() => setHorizon(value)}>{value} séances</button>)}</div>
          <div className="simulation-quantiles"><span>10e centile <strong>{pctLabel(lowerReturn === undefined ? undefined : lowerReturn * 100)}</strong></span><span>Médiane <strong>{pctLabel(medianReturn === undefined ? undefined : medianReturn * 100)}</strong></span><span>90e centile <strong>{pctLabel(upperReturn === undefined ? undefined : upperReturn * 100)}</strong></span></div>
        </div>
        <p className="simulation-chart-note">La zone bleue pâle montre des rendements glissants observés sur cette période et ce titre. Ce sont des repères historiques, pas des probabilités, une estimation d’événement ou une prévision.</p>
      </section>

      <aside className="simulation-event-panel" aria-labelledby="simulation-events-title">
        <div className="simulation-panel-heading"><span><CalendarDays size={15} /></span><div><h2 id="simulation-events-title">Événements et réactions</h2><p>{shownEvents.length} événement{shownEvents.length === 1 ? '' : 's'} dans la période</p></div></div>
        {selected ? (
          <article className="simulation-selected-event">
            <div className="simulation-event-title"><span>{eventNames[selected.kind] ?? selected.kind}</span><time>{dateLabel(selected.date)}</time></div>
            <p>{selected.value !== null ? `${selected.value.toLocaleString('fr-CA')} ${selected.unit ?? ''}` : 'Valeur non fournie dans le jeu de données'}</p>
            {selected.observedPriceDate && selected.observedPriceDate !== selected.date && <small>Premier cours disponible après la date ex : {dateLabel(selected.observedPriceDate)}</small>}
            <div className="simulation-return-grid">
              {[[1, '1 séance'], [5, '5 séances'], [20, '20 séances']].map(([key, label]) => {
                const value = selected.observedReturnsPct[`${key}observations` as keyof typeof selected.observedReturnsPct];
                return <div key={key}><span>{label}</span><strong className={typeof value === 'number' ? value < 0 ? 'is-negative' : 'is-positive' : ''}>{typeof value === 'number' && (value < 0 ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />)}{pctLabel(value)}</strong></div>;
              })}
            </div>
            <a className="simulation-event-source" href={`https://finance.yahoo.com/quote/${encodeURIComponent(data.asset.ticker)}/history/`} target="_blank" rel="noreferrer">Source des séries : Yahoo Finance <span aria-hidden="true">↗</span></a>
          </article>
        ) : selectedRegulation ? (
          <article className="simulation-selected-event is-regulation-card">
            <div className="simulation-event-title"><span>{selectedRegulation.type}</span><time>{dateLabel(selectedRegulation.publishedAt)}</time></div>
            <h3>{selectedRegulation.title}</h3>
            {selectedRegulation.agencies.length > 0 && <p>{selectedRegulation.agencies.join(' · ')}</p>}
            <small>{selectedRegulation.summary}</small>
            {selectedRegulation.effectiveOn && <small>Date d’entrée en vigueur indiquée : {dateLabel(selectedRegulation.effectiveOn)}</small>}
            <div className="simulation-return-grid">
              {[[1, '1 séance'], [5, '5 séances'], [20, '20 séances']].map(([key, label]) => {
                const value = returnsAfterDate(data, selectedRegulation.publishedAt)[String(key) as '1'|'5'|'20'];
                return <div key={key}><span>{label}</span><strong className={typeof value === 'number' ? value < 0 ? 'is-negative' : 'is-positive' : ''}>{pctLabel(value)}</strong></div>;
              })}
            </div>
            <small>Le rendement coïncide avec la date de publication; il n’établit pas un lien de causalité ni l’applicabilité à cet émetteur.</small>
            {selectedRegulation.url.startsWith('https://www.federalregister.gov/') && <a className="simulation-event-source" href={selectedRegulation.url} target="_blank" rel="noreferrer">Ouvrir le document Federal Register ↗</a>}
            {selectedRegulation.officialPdfUrl?.startsWith('https://www.govinfo.gov/') && <a className="simulation-event-source" href={selectedRegulation.officialPdfUrl} target="_blank" rel="noreferrer">PDF de l’édition officielle ↗</a>}
          </article>
        ) : (
          <div className="simulation-event-empty"><CalendarDays size={20} /><strong>Sélectionnez un repère du graphique</strong><span>Rendements ajustés après la première clôture disponible à la date ex ou après.</span></div>
        )}
        <div className="simulation-event-list" aria-label="Événements historiques">
          {shownEvents.slice().reverse().map((event) => <button type="button" key={event.id} aria-pressed={selectedId === event.id} onClick={() => onSelect(event.id)}><span className="simulation-event-dot" /><span><strong>{eventNames[event.kind] ?? event.kind}</strong><small>{dateLabel(event.date)}</small></span><span className="simulation-event-return">{pctLabel(event.observedReturnsPct['5observations'])}</span></button>)}
          {!shownEvents.length && <p>Aucun événement d’entreprise daté dans cette fenêtre.</p>}
        </div>
        {regulations.length > 0 && <div className="simulation-regulation-list">
          <div className="simulation-regulation-heading"><strong>Réglementation récente</strong><span>{shownRegulations.length}</span></div>
          {shownRegulations.slice(0, 8).map((event) => <button type="button" key={event.id} aria-pressed={selectedId === `reg:${event.id}`} onClick={() => onSelect(`reg:${event.id}`)}><span className="simulation-regulation-icon"><CalendarDays size={12} /></span><span><strong>{event.title}</strong><small>{dateLabel(event.publishedAt)} · {event.agencies[0] ?? event.type}</small></span></button>)}
        </div>}
      </aside>
    </>
  );
}

export function ScenariosPage() {
  const [assetList, setAssetList] = useState<SimulationAssetList>();
  const [ticker, setTicker] = useState('');
  const [history, setHistory] = useState<SimulationHistory>();
  const [regulations, setRegulations] = useState<SimulationRegulations>();
  const [regulationTopic, setRegulationTopic] = useState('tariff');
  const [regulationError, setRegulationError] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    loadSimulationAssets(controller.signal).then((result) => {
      setAssetList(result);
      setTicker(result.assets.find((asset) => asset.ticker === 'AAPL')?.ticker ?? result.assets[0]?.ticker ?? '');
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Les données de Simulation sont indisponibles.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setRegulations(undefined);
    setRegulationError('');
    loadSimulationRegulations(regulationTopic, controller.signal).then(setRegulations).catch((cause) => {
      if (!controller.signal.aborted) setRegulationError(cause instanceof Error ? cause.message : 'La source réglementaire est indisponible.');
    });
    return () => controller.abort();
  }, [regulationTopic]);

  useEffect(() => {
    if (!ticker) return;
    const controller = new AbortController();
    setHistory(undefined);
    setSelectedId(undefined);
    setError('');
    setLoading(true);
    loadSimulationHistory(ticker, controller.signal).then(setHistory).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'La série historique est indisponible.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [ticker]);

  const selected = useMemo(() => history?.events.find((event) => event.id === selectedId), [history, selectedId]);
  const selectedRegulation = useMemo(() => regulations?.documents.find((event) => `reg:${event.id}` === selectedId), [regulations, selectedId]);

  return (
    <section className="simulation-page" aria-labelledby="simulation-title">
      <header className="simulation-header">
        <div><span className="simulation-eyebrow"><Activity size={14} /> OBSERVATIONS ET HYPOTHÈSES</span><h1 id="simulation-title">Simulation</h1><p>Explorez l’historique d’un actif et mesurez les mouvements observés après des événements datés.</p></div>
        <label className="simulation-asset-select"><span>Titre</span><select value={ticker} onChange={(event) => setTicker(event.target.value)} disabled={!assetList}><option value="" disabled>Choisir un actif</option>{assetList?.assets.map((asset) => <option key={asset.ticker} value={asset.ticker}>{asset.ticker} · {asset.name}</option>)}</select></label>
      </header>

      {loading && !history ? <div className="simulation-state" role="status"><LoaderCircle size={17} className="simulation-spinner" />Chargement des séries historiques…</div> : null}
      {error ? <div className="simulation-state is-error" role="alert"><AlertTriangle size={17} /><span>{error}<small>Configurez SIMULATION_DATA_DIR vers le jeu de données autorisé pour activer cet espace.</small></span></div> : null}

      {history ? (
        <>
          <div className="simulation-source-note"><ShieldCheck size={16} /><span><strong>{history.source}</strong> · extraction au {dateLabel(history.sourceAsOf)} · {history.prices.length.toLocaleString('fr-CA')} observations · devise {history.currency}</span><span className="simulation-source-badge"><Database size={13} /> Données historiques</span></div>
          <div className="simulation-regulation-toolbar"><span><CalendarDays size={14} /> Filtrer les actes réglementaires</span><div role="group" aria-label="Thème de recherche réglementaire">{[['tariff','Tarifs'],['supply-chain','Chaîne logistique'],['export-controls','Contrôles export'],['energy','Énergie']].map(([id,label])=><button type="button" key={id} aria-pressed={regulationTopic===id} onClick={()=>setRegulationTopic(id)}>{label}</button>)}</div>{regulationError&&<small role="status">{regulationError}</small>}</div>
          <div className="simulation-workspace"><HistoricalChart data={history} regulations={regulations?.documents} selectedId={selectedId} onSelect={setSelectedId} /></div>
          <div className="simulation-method-note"><ShieldCheck size={15} /><span><strong>Méthode et limites.</strong> {history.method} {history.limitations.join(' ')} {regulations?.legalStatus}</span>{regulations?.sourceUrl && <a href={regulations.sourceUrl} target="_blank" rel="noreferrer">Documentation de l’API réglementaire ↗</a>}<Link to="/app/evidence">Sources et méthode</Link></div>
          <Link className="simulation-assistant-link" to="/app/assistant" state={{ initialPrompt: selected ? `Analyse l’événement ${selected.kind} du ${selected.date} sur ${history.asset.name} (${history.asset.ticker}). Les rendements historiques calculés sont : une séance ${pctLabel(selected.observedReturnsPct['1observations'])}, cinq séances ${pctLabel(selected.observedReturnsPct['5observations'])}, vingt séances ${pctLabel(selected.observedReturnsPct['20observations'])}. Explique ce qu’ils mesurent, distingue corrélation et causalité, et indique ce qu’il faudrait comme sources supplémentaires avant d’en déduire une réaction à un événement futur.` : selectedRegulation ? `Évalue prudemment la pertinence possible du document réglementaire « ${selectedRegulation.title} », publié le ${selectedRegulation.publishedAt} par ${selectedRegulation.agencies.join(', ') || 'une agence fédérale'}, pour ${history.asset.name} (${history.asset.ticker}). La source primaire est ${selectedRegulation.url}. Les rendements ajustés observés après publication sont ${pctLabel(returnsAfterDate(history, selectedRegulation.publishedAt)['1'])} à une séance, ${pctLabel(returnsAfterDate(history, selectedRegulation.publishedAt)['5'])} à cinq séances et ${pctLabel(returnsAfterDate(history, selectedRegulation.publishedAt)['20'])} à vingt séances. Distingue le texte officiel, l’applicabilité à cette entreprise, la coïncidence et la causalité; n’infère pas une exposition qui n’est pas établie.` : `Explique les limites de l’analyse historique de ${history.asset.name} (${history.asset.ticker}) et les sources nécessaires pour étudier un événement de marché.` }}>Discuter de cette analyse avec l’Assistant →</Link>
        </>
      ) : null}
      {!loading && !error && assetList && !history ? <div className="simulation-state" role="status"><LoaderCircle size={17} className="simulation-spinner" />Chargement de {ticker}…</div> : null}
    </section>
  );
}
