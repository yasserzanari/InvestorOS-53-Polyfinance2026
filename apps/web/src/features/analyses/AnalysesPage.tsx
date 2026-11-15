import { useEffect, useState } from 'react';
import { ArrowRight, BookOpenCheck, ChartNoAxesCombined, CircleHelp, FileSearch, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDemoAccount } from '../../shared/DemoAccountContext';
import { loadDemoOverview, loadResearchHistory, type DemoApiConnection, type DemoOverview, type ResearchHistoryItem } from '../../shared/api';
import './analyses.css';

type LoadState = { kind: 'loading' } | { kind: 'ready'; result: DemoApiConnection };

function LocalResearchHistory({ analyses, persona, error }: { analyses: ResearchHistoryItem[] | null; persona: ResearchHistoryItem['persona']; error?: string }) {
  if (error) return <div className="analyses-empty is-unavailable" role="alert"><span><CircleHelp size={19}/></span><h2>Recherche locale indisponible</h2><p>{error} Démarrez le serveur local avec <code>npm run dev:local</code> et configurez son profil AWS IAM si vous voulez lire les analyses AWS.</p></div>;
  if (analyses === null) return <p className="analyses-loading" role="status">Lecture des recherches enregistrées…</p>;
  return <>
    <div className="analyses-source-status is-connected" role="status"><span className="analyses-source-icon"><BookOpenCheck size={16}/></span><div><strong>Historique du moteur de recherche</strong><p>Lecture par le serveur local via l’entrée IAM limitée aux analyses · {analyses.length} résultat{analyses.length === 1 ? '' : 's'} · compte fictif {persona}</p></div><span className="analyses-status-badge">AWS IAM</span></div>
    {analyses.length ? <div className="analyses-record-list">{analyses.map((item,index)=>{
      const status = ({queued:'En attente',running:'En cours',complete:'Terminée',completed:'Terminée',partial:'Partielle',failed:'Échec',cancelled:'Annulée'} as Record<string,string>)[item.status.toLowerCase()] ?? item.status;
      const date = item.created_at && !Number.isNaN(Date.parse(item.created_at)) ? new Intl.DateTimeFormat('fr-CA',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.created_at)) : item.created_at;
      return <article className="analyses-record" key={item.analysis_id}><div className="analyses-record-icon"><ChartNoAxesCombined size={16}/></div><div className="analyses-record-content"><div className="analyses-record-meta"><span>{status}</span>{date&&<time>{date}</time>}</div><h2>{item.question}</h2>{item.error&&<p>{item.error}</p>}<Link to={`/app/assistant?analysis_id=${encodeURIComponent(item.analysis_id)}`} className="analyses-assistant-link">Ouvrir le suivi, les événements et les preuves <ArrowRight size={14}/></Link></div></article>;
    })}</div> : <div className="analyses-empty"><span><CircleHelp size={19}/></span><h2>Aucune recherche enregistrée</h2><p>Les recherches réellement lancées depuis l’Assistant apparaîtront ici.</p><Link to="/app/assistant">Ouvrir l’Assistant <ArrowRight size={14}/></Link></div>}
  </>;
}

function firstText(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function AnalysisCard({ record, index }: { record: Record<string, unknown>; index: number }) {
  const title = firstText(record, ['title', 'name', 'question', 'analysis_name', 'display_name']) ?? `Analyse enregistrée ${index + 1}`;
  const summary = firstText(record, ['summary', 'result', 'answer', 'description', 'rationale', 'content']);
  const status = firstText(record, ['status', 'state']);
  const statusLabel = status ? ({ completed: 'Terminée', complete: 'Terminée', done: 'Terminée', running: 'En cours', active: 'En cours', pending: 'En attente', failed: 'Échec', error: 'Échec' }[status.toLowerCase()] ?? status) : 'Enregistrée dans la démo';
  const date = firstText(record, ['created_at', 'createdAt', 'updated_at', 'date', 'as_of']);
  const dateLabel = date && !Number.isNaN(Date.parse(date)) ? new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium' }).format(new Date(date)) : date;

  return (
    <article className="analyses-record">
      <div className="analyses-record-icon"><ChartNoAxesCombined size={16} /></div>
      <div className="analyses-record-content">
        <div className="analyses-record-meta">
          <span>{statusLabel}</span>
          {dateLabel && <time>{dateLabel}</time>}
        </div>
        <h2>{title}</h2>
        {summary ? <p>{summary}</p> : <p className="analyses-record-fallback">Le résumé n’est pas fourni par cet enregistrement. Consultez ses champs enregistrés ci-dessous.</p>}
        <details className="analyses-record-details">
          <summary><BookOpenCheck size={13} /> Champs de l’enregistrement</summary>
          <pre>{JSON.stringify(record, null, 2)}</pre>
        </details>
      </div>
    </article>
  );
}

function ConnectionState({ result, persona }: { result: DemoApiConnection; persona: DemoOverview['persona'] }) {
  if (result.status === 'connected') {
    const count = result.overview.analyses.length;
    return (
      <>
        <div className="analyses-source-status is-connected" role="status">
          <span className="analyses-source-icon"><BookOpenCheck size={16} /></span>
          <div><strong>Lecture AWS connectée</strong><p>{result.overview.account.display_name} · table DynamoDB de démonstration · {count} analyse{count === 1 ? '' : 's'} chargée{count === 1 ? '' : 's'} (jusqu’aux 25 plus récentes)</p></div>
          <span className="analyses-status-badge">Données fictives</span>
        </div>
        {count > 0 ? (
          <div className="analyses-record-list">{result.overview.analyses.map((record, index) => <AnalysisCard key={firstText(record, ['analysis_id', 'id']) ?? `${persona}-${index}`} record={record} index={index} />)}</div>
        ) : (
          <div className="analyses-empty">
            <span><CircleHelp size={19} /></span>
            <h2>Aucune analyse enregistrée</h2>
            <p>Le compte de démonstration ne contient pas encore d’analyse dans DynamoDB. L’Assistant peut examiner les données disponibles et organiser les étapes dans un onglet partagé; cette conversation ne crée pas, à elle seule, un enregistrement AWS d’analyse.</p>
            <Link to="/app/assistant" state={{ initialPrompt: 'Prépare une analyse à partir des données réellement disponibles pour mon compte de démonstration. Commence par indiquer les données que tu peux lire, demande les précisions manquantes et ne prétends pas enregistrer un résultat dans AWS.' }}>Préparer avec l’Assistant <ArrowRight size={14} /></Link>
          </div>
        )}
      </>
    );
  }

  const message = result.status === 'not_configured'
    ? 'La connexion à l’API de démonstration n’est pas configurée dans cet environnement.'
    : result.status === 'rate_limited'
      ? 'L’API limite temporairement les lectures. Réessayez dans quelques instants.'
      : 'Les analyses AWS sont temporairement indisponibles.';
  return (
    <div className="analyses-empty is-unavailable" role="status">
      <span><RefreshCw size={18} /></span>
      <h2>Historique indisponible</h2>
      <p>{message} Aucun exemple de remplacement n’est affiché.</p>
      <Link to="/app/assistant" state={{ initialPrompt: 'Aide-moi à préparer une analyse. Vérifie d’abord quelles données de démonstration sont disponibles et signale toute source inaccessible.' }}>Vérifier avec l’Assistant <ArrowRight size={14} /></Link>
    </div>
  );
}

export function AnalysesPage() {
  const { activeAccount } = useDemoAccount();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [research, setResearch] = useState<{analyses:ResearchHistoryItem[]|null;error?:string}>({analyses:null});

  useEffect(() => {
    const controller = new AbortController();
    if (import.meta.env.DEV) {
      setResearch({analyses:null});
      loadResearchHistory(activeAccount.id, controller.signal).then(analyses=>{
        if(!controller.signal.aborted)setResearch({analyses});
      }).catch(error=>{
        if(!controller.signal.aborted)setResearch({analyses:null,error:error instanceof Error?error.message:'Connexion au serveur local impossible.'});
      });
      return () => controller.abort();
    }
    setState({ kind: 'loading' });
    loadDemoOverview(activeAccount.id, controller.signal).then((result) => {
      if (!controller.signal.aborted) setState({ kind: 'ready', result });
    }).catch(() => {
      if (!controller.signal.aborted) setState({ kind: 'ready', result: { status: 'unavailable' } });
    });
    return () => controller.abort();
  }, [activeAccount.id]);

  return (
    <section className="analyses-page" aria-labelledby="analyses-title">
      <header className="analyses-header">
        <div>
          <span className="analyses-eyebrow"><FileSearch size={14} /> ESPACE DE TRAVAIL</span>
          <h1 id="analyses-title">Analyses</h1>
          <p>Consultez les analyses enregistrées du compte de démonstration et préparez la suite avec l’Assistant.</p>
        </div>
        <Link to="/app/assistant" className="analyses-assistant-link">Ouvrir l’Assistant <ArrowRight size={14} /></Link>
      </header>
      {import.meta.env.DEV ? <LocalResearchHistory analyses={research.analyses} persona={activeAccount.id} error={research.error}/> : state.kind === 'loading' ? <p className="analyses-loading" role="status">Lecture des analyses du compte…</p> : <ConnectionState result={state.result} persona={activeAccount.id} />}
    </section>
  );
}

export default AnalysesPage;
