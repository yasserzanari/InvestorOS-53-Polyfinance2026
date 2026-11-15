import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BookOpen, ChartNoAxesCombined, Check, CircleAlert, FileSearch, LoaderCircle, Newspaper, RefreshCw, ShieldCheck } from 'lucide-react';
import { useDemoAccount } from '../../shared/DemoAccountContext';
import { fullDate, numberLabel, preciseDate, readableText, sourceUrl } from './presentation';
import type { ExplorationTarget } from './types';
import { investigateMovement, type MovementInvestigation as Investigation } from './movement-investigation-api';
import './movement-investigation.css';

const factorLabels: Record<string, string> = { company: 'Entreprise', earnings: 'Résultats & attentes', macro: 'Macroéconomie', sector: 'Exposition sectorielle', flows: 'Flux & positionnement' };
export function MovementInvestigation({ target, onResult }: { target: ExplorationTarget; onResult?: (result: Investigation) => void }) {
  const { activeAccount } = useDemoAccount();
  const [result, setResult] = useState<Investigation>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const move = target.movement;
  const resultCallback = useRef(onResult); resultCallback.current = onResult;
  useEffect(() => {
    setResult(undefined); setError('');
    if (!move || !target.analysisId || !target.ticker) return;
    const controller = new AbortController(); setBusy(true);
    const timer = setTimeout(() => {
      void investigateMovement({ analysisId: target.analysisId!, accountId: activeAccount.id, ticker: target.ticker!, previousDate: move.previousDate, date: move.date }, controller.signal)
        .then(data => { if (!controller.signal.aborted) { setResult(data); resultCallback.current?.(data); } })
        .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Analyse indisponible.'); })
        .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    }, 120);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [activeAccount.id, target.analysisId, target.ticker, move?.previousDate, move?.date, revision]);
  if (!move) return null;
  return <section className="mi-root" aria-label="Analyse des facteurs du mouvement">
    {busy && <div className="mi-loading" role="status"><LoaderCircle size={18} className="hx-spin"/><div><strong>Analyse de la séance en cours</strong><p>Comparaison aux clôtures de marché, recherche de presse datée et examen des passages réellement lus.</p></div></div>}
    {error && <div className="mi-error" role="alert"><CircleAlert size={17}/><div><p>{error}</p><button type="button" onClick={() => setRevision(value => value + 1)}><RefreshCw size={13}/>Réessayer l’analyse</button></div></div>}
    {result && <>
      {result.synthesisStatus === 'unavailable' && <div className="mi-error" role="status"><CircleAlert size={16}/><div><p>La synthèse des documents n’a pas abouti. Les calculs de marché restent disponibles; aucune interprétation documentaire n’est confirmée.</p><button type="button" onClick={() => setRevision(value => value + 1)}><RefreshCw size={13}/>Réessayer la synthèse</button></div></div>}
      <div className="mi-conclusion"><span><FileSearch size={20}/></span><div><strong>Ce que les éléments disponibles permettent de dire</strong><p>{result.conclusion}</p></div></div>
      <section className="mi-comparison"><h4><ChartNoAxesCombined size={16}/>Marché et titre, sur les mêmes clôtures</h4><div><article><small>{target.ticker}</small><strong className={move.changePct < 0 ? 'is-down' : 'is-up'}>{move.changePct > 0 ? '+' : ''}{numberLabel(move.changePct)} %</strong><span>Titre étudié</span></article>{result.benchmarks.map(benchmark => <article key={benchmark.ticker}><small>{benchmark.ticker}</small><strong className={(benchmark.changePct ?? 0) < 0 ? 'is-down' : 'is-up'}>{benchmark.available && typeof benchmark.changePct === 'number' ? `${benchmark.changePct > 0 ? '+' : ''}${numberLabel(benchmark.changePct)} %` : 'Indisponible'}</strong><span>{benchmark.ticker === 'QQQ' ? 'Nasdaq-100' : 'Marché large américain'}</span></article>)}</div><p>Comparaison descriptive : l’écart ne mesure pas la part de baisse « causée » par le marché.</p></section>
      <details className="mi-observations"><summary><Check size={15}/>Calculs et faits observés</summary><ul>{result.observations.map(observation => <li key={observation}>{readableText(observation)}</li>)}</ul></details>
      {result.documents.some(document => document.documentRole === 'calendar_only') && <section className="mi-calendar-context"><h4><BookOpen size={16}/>Une annonce à ne pas confondre avec des résultats</h4>{result.documents.filter(document => document.documentRole === 'calendar_only').map(document => <article key={document.id}><p>Le communiqué publié le {preciseDate(document.publishedAt)} annonce une conférence future. Il ne démontre pas que des résultats ont provoqué cette variation.</p><details><summary>Vérifier le passage lu</summary><blockquote>{document.excerpt}</blockquote>{sourceUrl(document.url) && <a href={sourceUrl(document.url)} target="_blank" rel="noreferrer">{document.title}<ArrowUpRight size={13}/></a>}</details></article>)}</section>}
      <div className="mi-dimensions" aria-label="Périmètre effectivement examiné"><span><Check size={12}/>Marché : {result.coverage.market === 'compared' ? 'comparé' : 'indisponible'}</span><span><BookOpen size={12}/>{result.documents.length} document(s) lu(s)</span><span><Newspaper size={12}/>Presse : {result.news.status === 'complete' ? `${result.news.leads.length} piste(s)` : 'indisponible'}</span><span><CircleAlert size={12}/>Flux non documentés</span></div>
      <section className="mi-factors"><h4><ShieldCheck size={16}/>Interprétations à confronter aux preuves</h4>{result.factors.length ? result.factors.map((factor, index) => {
        const source = result.documents.find(document => document.id === factor.sourceId);
        return <article key={`${factor.sourceId}-${index}`}><header><span>{factorLabels[factor.category] || factor.category}</span><small>Hypothèse · causalité non établie</small></header><h5>{factor.title}</h5><p>{factor.interpretation}</p><div className="mi-counterpoint"><strong>Ce qui peut nuancer cette lecture</strong><p>{factor.counterpoint}</p></div>{source && <details><summary>Passage qui étaye cette piste</summary><blockquote>{factor.quote}</blockquote><p>{source.title} · {preciseDate(source.publishedAt)}</p>{sourceUrl(source.url) && <a href={sourceUrl(source.url)} target="_blank" rel="noreferrer">Vérifier le document <ArrowUpRight size={13}/></a>}</details>}</article>;
      }) : <p>{result.synthesisStatus === 'unavailable' ? 'Les documents reçus n’ont pas pu faire l’objet d’une synthèse exploitable.' : 'Aucun passage lu et antérieur à la clôture n’étaye un déclencheur spécifique.'} Les comparaisons de marché ci-dessus sont calculées, mais attribuer la séance à des résultats, à une annonce ou à des ventes institutionnelles serait prématuré.</p>}</section>
      <details className="mi-news"><summary><Newspaper size={15}/>Pistes de presse à vérifier <span>{result.news.leads.length}</span></summary><p>{result.news.message}</p>{result.news.leads.map(lead => <article key={lead.url}>{sourceUrl(lead.url) ? <a href={sourceUrl(lead.url)} target="_blank" rel="noreferrer">{lead.title}<ArrowUpRight size={13}/></a> : <strong>{lead.title}</strong>}<small>{lead.publisher} · indexation le {preciseDate(lead.indexedAt)}</small><span>Contenu intégral non lu · ne constitue pas une cause vérifiée</span></article>)}{sourceUrl(result.news.queryUrl) && <a href={sourceUrl(result.news.queryUrl)} target="_blank" rel="noreferrer">Vérifier la requête d’indexation <ArrowUpRight size={13}/></a>}</details>
      <details className="mi-limits" open><summary><CircleAlert size={15}/>Limites de cette analyse</summary><ul>{result.limitations.map(limit => <li key={limit}>{limit}</li>)}</ul><footer>Vérifié le {preciseDate(result.checkedAt)} · clôtures du {fullDate(result.previousDate)} au {fullDate(result.date)}</footer></details>
    </>}
  </section>;
}
