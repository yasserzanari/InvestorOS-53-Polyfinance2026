import { RefreshCw } from 'lucide-react';
import {lazy,Suspense,useState} from 'react';
import { useDemoAccount } from '../../../shared/DemoAccountContext';
import {ResearchReport} from './ResearchReport';
import type { ResearchRun, SkillUse } from '../research-workspace';

const AnalysisJourney=lazy(()=>import('../../analyses/AnalysisJourney').then(module=>({default:module.AnalysisJourney})));

const labels: Record<string,string> = {loading:'Chargement du suivi',queued:'En file',running:'En cours',complete:'Terminée',completed:'Terminée',partial:'Résultat partiel',failed:'Échec',cancelled:'Annulée'};

export function SkillsUsedTab({skills}:{skills:SkillUse[]}) {
  return <div className="pw-research-tab"><p>Procédures effectivement chargées par l’assistant et les agents de recherche. Leur chargement ne garantit pas à lui seul la qualité du résultat.</p>{skills.length?<ul className="pw-skills-list">{skills.map(skill=><li key={`${skill.role}-${skill.id}-${skill.sha256}`}><strong>{skill.id}</strong><span>{skill.role} · {skill.actor}</span><small>Version {skill.version??'non fournie'}</small>{skill.sha256&&<code title={skill.sha256}>SHA-256 · {skill.sha256.slice(0,16)}…</code>}</li>)}</ul>:<p>Aucun skill chargé dans cette conversation.</p>}</div>;
}

export function ResearchResultsTab({runs,onRefresh}:{runs:ResearchRun[];onRefresh:()=>void}) {
  const {activeAccount}=useDemoAccount();
  const [views,setViews]=useState<Record<string,string>>({});
  return <div className="pw-research-tab pw-research-results">
    {!runs.length&&<p>Aucune recherche lancée depuis cette conversation.</p>}
    {[...runs].reverse().map(run=>{
      const result=run.result;
      return <article className="pw-research-result" key={run.analysis_id}>
        {!result&&<header className="pw-run-header"><h3>{run.question??'Analyse d’entreprise'}</h3><span role="status">{labels[run.status]??run.status}</span><button type="button" aria-label="Actualiser le suivi" title="Actualiser le suivi" onClick={onRefresh}><RefreshCw size={15}/></button></header>}
        {run.trackingError&&<p role="status" className="pw-research-warning">{run.trackingError}</p>}
        {run.error&&<p role="alert" className="pw-research-warning">La recherche a échoué. Consultez son historique pour le détail technique.</p>}
        {!result&&!run.error&&!['failed','cancelled'].includes(run.status)&&<p>Le moteur prépare les preuves et la synthèse. Les résultats apparaîtront ici dès leur réception.</p>}
        {result&&<>
          <Suspense fallback={<p>Chargement des vues interactives…</p>}><AnalysisJourney key={`${activeAccount.id}:${run.analysis_id}`} run={run} accountId={activeAccount.id} onRefresh={onRefresh} onViewChange={view=>setViews(current=>current[run.analysis_id]===view?current:{...current,[run.analysis_id]:view})}/></Suspense>
          {views[run.analysis_id]!=='simulation'&&<ResearchReport run={run}/>}
        </>}
        {run.events_truncated&&<p className="pw-research-warning">La trace affichée est partielle.</p>}
      </article>;
    })}
  </div>;
}
