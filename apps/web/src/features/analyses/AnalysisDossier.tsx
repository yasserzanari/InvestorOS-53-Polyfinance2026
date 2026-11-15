import { useState } from 'react';
import { Activity, ArrowUpRight, BookOpen, CalendarDays, Check, CircleAlert, FileCheck2, Layers3, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ResearchReport } from '../profiles/components/ResearchReport';
import { terminalResearch, type ResearchRun } from '../profiles/research-workspace';
import { fullDate, preciseDate, readableText } from '../analysis-interactions/presentation';
import { AnalysisJourney, analysisTicker } from './AnalysisJourney';
import { ResearchActivity } from './ResearchActivity';
import { contentRecord, observedAgents, runStatus } from './research-presentation';
import './dossier.css';

export function AnalysisDossier({ run, accountId, onRefresh, refreshing, error }: { run: ResearchRun; accountId: string; onRefresh: () => void; refreshing: boolean; error?: string }) {
  const ticker = analysisTicker(run);
  const [view,setView]=useState('company');
  const active = !terminalResearch(run.status);
  const evidence = run.evidence || [];
  const agents = observedAgents(run);
  const coverage = run.result?.coverage;
  const checks = coverage?.checks || [];
  const covered = checks.filter(check => check.status === 'covered').length;
  const company = evidence.map(proof => contentRecord(proof.content)).find(content => content.ticker === ticker || (content.name && content.tickers && Array.isArray(content.tickers) && content.tickers.includes(ticker)));
  const name = typeof company?.name === 'string' ? company.name : ticker || 'Recherche documentaire';
  const risks = run.result?.sections?.filter(section => /risque|surveill|incertitude/i.test(section.title)) || [];
  const Icon = active ? LoaderCircle : ['failed', 'cancelled'].includes(run.status) ? CircleAlert : Check;
  return <section className="ad-root" aria-label="Dossier d’analyse">
    <header className="ad-heading"><div className="ad-company"><span className="ad-company-mark" aria-hidden="true">{ticker?.slice(0, 2) || <Layers3 size={24}/>}</span><div><div className="ad-company-line"><h1>{name}</h1>{ticker && <span>{ticker}</span>}</div><p>{run.question || 'Analyse en préparation'}</p></div></div><div className="ad-heading-actions"><span className={`ad-status ${active ? 'is-running' : ''}`} role="status"><Icon size={13} className={active ? 'ra-spin' : ''}/>{runStatus[run.status] || run.status}</span><button type="button" onClick={onRefresh} disabled={refreshing} aria-label="Actualiser l’analyse"><RefreshCw size={15} className={refreshing ? 'ra-spin' : ''}/></button></div></header>
    <div className="ad-context"><span><CalendarDays size={13}/>{coverage?.window ? `${fullDate(coverage.window.start)} — ${fullDate(coverage.window.end)}` : 'Période en cours de vérification'}</span>{run.completed_at && <span>Terminée le {preciseDate(run.completed_at)}</span>}<Link to={`/app/assistant?analysis_id=${encodeURIComponent(run.analysis_id)}`}>Poursuivre dans le chat <ArrowUpRight size={13}/></Link></div>
    {error && <div className="ad-notice" role="alert"><CircleAlert size={16}/><p>{error} Les dernières données reçues restent affichées.</p><button type="button" onClick={onRefresh}>Réessayer</button></div>}
    {run.error && <div className="ad-notice" role="alert"><CircleAlert size={16}/><p>La recherche a rencontré une erreur. Les opérations enregistrées sont consultables dans l’activité.</p></div>}
    <div className="ad-metrics"><div><FileCheck2 size={17}/><span><strong>{evidence.length}</strong> sources reçues</span></div><div><Activity size={17}/><span><strong>{agents.length}</strong> intervenants observés</span></div><div><BookOpen size={17}/><span><strong>{run.result?.claims?.length ?? '—'}</strong> constats analysés</span></div><div><ShieldCheck size={17}/><span><strong>{checks.length ? `${covered}/${checks.length}` : '—'}</strong> critères documentés</span></div></div>
    <div className="ad-layout"><div className="ad-main"><AnalysisJourney run={run} accountId={accountId} standalone onViewChange={setView}/>
      {run.result && view!=='simulation' && <section className="ad-report"><header><div><BookOpen size={17}/><h2>Le dossier complet</h2></div><span>Synthèse, chiffres, preuves et limites</span></header><ResearchReport run={run}/></section>}
    </div><aside className="ad-sidebar" aria-label="Synthèse et suivi des sources"><section className="ad-brief"><header><span><ShieldCheck size={16}/></span><h2>À retenir</h2></header><p>{run.result?.summary ? readableText(run.result.summary) : (active ? 'Les sources sont collectées et vérifiées. La synthèse apparaîtra après leur lecture.' : 'Aucune synthèse confirmée n’est disponible pour cette recherche.')}</p>{risks.length > 0 && <details><summary>Points de vigilance <span>{risks.length}</span></summary>{risks.map(section => <article key={section.title}><h3>{section.title}</h3><p>{readableText(section.text)}</p></article>)}</details>}{coverage?.missing?.length ? <div className="ad-missing"><CircleAlert size={14}/><span>{coverage.missing.length} élément(s) de couverture à compléter</span></div> : checks.length > 0 && <div className="ad-coverage"><Check size={13}/><span>{covered} critères documentés sur {checks.length}</span></div>}</section><ResearchActivity run={run}/><p className="ad-research-note">Une source consultée peut contenir une déclaration ou une hypothèse. Les événements annoncés ne prédisent pas la réaction du marché.</p></aside></div>
  </section>;
}
