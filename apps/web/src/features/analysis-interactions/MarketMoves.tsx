import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronRight, FileSearch, LoaderCircle, RefreshCw, SearchCheck } from 'lucide-react';
import { loadMarketMovements, type MarketMovement, type MarketMovementCandidate, type MarketMovementReport } from '../../shared/api';
import { fullDate, moneyLabel, numberLabel, preciseDate, sourceUrl } from './presentation';
import type { ExplorationTarget } from './types';
import './market-moves.css';
import { MovementInvestigation } from './MovementInvestigation';
import type { MovementInvestigation as Investigation } from './movement-investigation-api';

export type MovementResearchContext = { analysisId: string; accountId: string };
export const orderedMovementDocuments = (candidates: MarketMovementCandidate[]) => [...candidates].sort((a, b) => Number(/^(8-k|10-[kq]|6-k)$/i.test(a.title)) - Number(/^(8-k|10-[kq]|6-k)$/i.test(b.title)));
export function useMarketMoves(context: MovementResearchContext | undefined, ticker: string, start: string | undefined, end: string | undefined, thresholdPct: number) {
  const [report, setReport] = useState<MarketMovementReport>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const appliedRevision = useRef(0);
  const analysisId = context?.analysisId, accountId = context?.accountId;
  useEffect(() => {
    setReport(undefined); setError('');
    if (!analysisId || !accountId || !start || !end) { setLoading(false); return; }
    const controller = new AbortController(); setLoading(true);
    const refresh = revision !== appliedRevision.current;
    appliedRevision.current = revision;
    const timer = setTimeout(() => {
      void loadMarketMovements({ analysisId, accountId, ticker, start, end, thresholdPct, refresh }, controller.signal).then(result => {
        if (!controller.signal.aborted) setReport(result);
      }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Lecture des documents indisponible.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [analysisId, accountId, ticker, start, end, thresholdPct, revision]);
  return { report, loading, error, refresh: () => setRevision(value => value + 1) };
}

export function movementTarget(move: MarketMovement, report: MarketMovementReport): ExplorationTarget {
  return {
    id: move.id, kind: 'movement', title: `${report.ticker} · ${move.direction === 'down' ? 'baisse' : 'hausse'} de ${numberLabel(Math.abs(move.changePct))} %`,
    date: move.date, dateKind: 'observed', dateLabel: `${fullDate(move.date)} · variation entre deux clôtures`, ticker: report.ticker,
    classification: report.source.classification === 'illustrative' ? 'illustrative' : 'historical', analysisId: report.analysisId,
    movement: move, summary: `${move.explanation} Seuil de repérage : ${report.thresholdPct} % entre deux clôtures.`,
    source: sourceUrl(report.source.url) ? { title: report.source.title, url: sourceUrl(report.source.url)!, publisher: 'Source des cours' } : undefined,
    metrics: [{ label: 'Clôture précédente', value: `${moneyLabel(move.previousPrice, report.currency)} · ${fullDate(move.previousDate)}` }, { label: 'Clôture observée', value: `${moneyLabel(move.price, report.currency)} · ${fullDate(move.date)}` }, { label: 'Variation calculée', value: `${move.changePct > 0 ? '+' : ''}${numberLabel(move.changePct)} %` }],
  };
}

export function movementArticleTarget(candidate: MarketMovementCandidate, ticker?: string, analysisId?: string): ExplorationTarget {
  return { id: `movement-document:${candidate.id}`, kind: 'event', title: candidate.title, summary: candidate.excerpt, date: candidate.publishedAt, dateKind: 'published', dateLabel: `${candidate.publicationPrecision === 'date' ? fullDate(candidate.publishedAt) : preciseDate(candidate.publishedAt)} · publication`, ticker, analysisId, classification: 'research', source: { title: candidate.title, publisher: candidate.sourceName, url: candidate.url, excerpt: candidate.excerpt }, metrics: [{ label: 'Document reçu', value: `${numberLabel(candidate.charactersRead)} caractères lus` }, { label: 'Rapport à la variation', value: candidate.timing === 'date_only' ? 'Même date; heure de publication non fournie' : 'Publié entre les deux clôtures observées' }] };
}

export function MarketMovesPanel({ report, loading, error, threshold, onThreshold, onRefresh, onExplore }: {
  report?: MarketMovementReport; loading: boolean; error: string; threshold: number;
  onThreshold: (value: number) => void; onRefresh: () => void; onExplore: (target: ExplorationTarget) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ordered = useMemo(() => [...(report?.movements || [])].sort((a, b) => b.date.localeCompare(a.date)), [report]);
  const documented = report?.movements.filter(move => move.status === 'context_found').length || 0;
  return <section className="mm-panel" aria-label="Comprendre les variations">
    <header><div><h4><FileSearch size={17} />Comprendre les variations</h4><p>Les annonces lues sont rapprochées de chaque mouvement important.</p></div><div className="mm-controls"><label>Seuil<select aria-label="Seuil des variations" value={threshold} onChange={event => onThreshold(Number(event.target.value))}>{[1, 3, 5, 10].map(value => <option key={value} value={value}>± {value} %</option>)}</select></label><button type="button" aria-label="Actualiser les sources des variations" title="Actualiser les sources autorisées" disabled={loading} onClick={onRefresh}>{loading ? <LoaderCircle size={14} className="hx-spin" /> : <RefreshCw size={14} />}</button></div></header>
    {loading && <p className="mm-status" role="status"><LoaderCircle size={14} className="hx-spin" />Lecture des sources autorisées et vérification des dates…</p>}
    {error && <p className="mm-status mm-error" role="alert">{error} Les cours restent consultables.</p>}
    {report && <>
      <div className="mm-coverage"><span><SearchCheck size={14} />{documented} / {report.totalMoves} mouvement{report.totalMoves > 1 ? 's' : ''} avec contexte documenté</span><span>Entre deux clôtures · seuil {threshold} %</span></div>
      <div className="mm-list">{ordered.slice(0, expanded ? ordered.length : 4).map(move => <button type="button" key={move.id} onClick={() => onExplore(movementTarget(move, report))}><span className={`mm-change ${move.direction === 'down' ? 'is-down' : 'is-up'}`}>{move.direction === 'down' ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}<strong>{move.changePct > 0 ? '+' : ''}{numberLabel(move.changePct)} %</strong></span><span className="mm-identity"><time>{fullDate(move.date)}</time><strong>{(move.candidates.find(candidate => !/^(8-k|10-[kq])$/i.test(candidate.title)) || move.candidates[0])?.title || 'Aucune raison établie dans les sources lues'}</strong><small>{move.status === 'context_found' ? `${move.candidates.length} document${move.candidates.length > 1 ? 's' : ''} de contexte · causalité non établie` : 'Ouvrir le détail de la recherche'}</small></span><ChevronRight size={16} /></button>)}</div>
      {report.totalMoves === 0 && <p className="mm-status">Aucune variation n’atteint ce seuil sur la période affichée.</p>}
      {report.totalMoves > 4 && <button type="button" className="mm-more" onClick={() => setExpanded(value => !value)}>{expanded ? 'Réduire les variations' : `Voir les ${report.totalMoves} variations`}<ChevronDown size={13} /></button>}
      {report.collection && ['unavailable', 'disabled', 'unsupported', 'partial'].includes(report.collection.status) && <p className="mm-status">{report.collection.message}</p>}
      <details className="mm-method"><summary>Sources lues et méthode de rapprochement</summary><p>{report.method}</p>{report.collection && <p>{report.collection.message}{report.collection.checkedAt ? ` · ${preciseDate(report.collection.checkedAt)}` : ''}</p>}<p>{report.evidenceCoverage.documentsRead} documents lus dans le périmètre; {report.evidenceCoverage.indexedLeadsExcluded} piste(s) indexée(s) exclue(s) des explications.</p>{report.limitations.map(limit => <p key={limit}>{limit}</p>)}</details>
    </>}
  </section>;
}

export function MovementEvidence({ target, onExplore, onInvestigation }: { target: ExplorationTarget; onExplore: (target: ExplorationTarget) => void; onInvestigation?: (result: Investigation) => void }) {
  const move = target.movement;
  if (!move) return null;
  return <section className="mm-evidence" aria-label="Éléments d’explication du mouvement"><MovementInvestigation target={target} onResult={onInvestigation}/>
    {move.candidates.length > 0 && <details><summary>Documents lus dans l’intervalle des deux clôtures ({move.candidates.length})</summary><div className="mm-documents">{orderedMovementDocuments(move.candidates).map(candidate => <article key={candidate.id}><header><span>{candidate.category === 'governance' ? 'Gouvernance' : candidate.category === 'earnings' ? 'Résultats' : candidate.category === 'regulation' ? 'Réglementation' : 'Document lu'}</span><time>{candidate.publicationPrecision === 'date' ? fullDate(candidate.publishedAt) : preciseDate(candidate.publishedAt)}</time></header><h4>{candidate.title}</h4><p>{candidate.excerpt}</p><div className="mm-document-footer"><span>{candidate.sourceName} · {numberLabel(candidate.charactersRead)} caractères lus</span><button type="button" onClick={() => onExplore(movementArticleTarget(candidate, target.ticker, target.analysisId))}>Lire le document <ChevronRight size={14} /></button></div><small>{candidate.timing === 'date_only' ? 'Heure inconnue : le document peut avoir été publié après la clôture.' : 'Publication située après la clôture précédente et avant cette clôture.'}</small></article>)}</div></details>}
  </section>;
}
