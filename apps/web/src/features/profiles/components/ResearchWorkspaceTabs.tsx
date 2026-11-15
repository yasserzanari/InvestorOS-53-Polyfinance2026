import { safeSourceUrl } from '../profile-api';
import type { ResearchEvidence, ResearchRun, SkillUse } from '../research-workspace';

const labels: Record<string,string> = {loading:'Chargement du suivi',queued:'En file',running:'En cours',complete:'Terminée',completed:'Terminée',partial:'Résultat partiel',failed:'Échec',cancelled:'Annulée'};
const claimLabels: Record<string,string> = {scheduled_event:'Événement annoncé',issuer_disclosure:'Déclaration de l’émetteur',issuer_financials:'Donnée financière publiée',filing:'Dépôt réglementaire',historical_price:'Historique',historical_risk:'Risque historique',macro:'Contexte macroéconomique'};

export function SkillsUsedTab({skills}:{skills:SkillUse[]}) {
  return <div className="pw-research-tab"><p>Procédures effectivement chargées par l’assistant et les agents de recherche. Leur chargement ne garantit pas à lui seul la qualité du résultat.</p>{skills.length?<ul className="pw-skills-list">{skills.map(skill=><li key={`${skill.role}-${skill.id}-${skill.sha256}`}><strong>{skill.id}</strong><span>{skill.role} · {skill.actor}</span><small>Version {skill.version??'non fournie'}</small>{skill.sha256&&<code title={skill.sha256}>SHA-256 · {skill.sha256.slice(0,16)}…</code>}</li>)}</ul>:<p>Aucun skill chargé dans cette conversation.</p>}</div>;
}

function References({ids,run}:{ids:string[];run:ResearchRun}) {
  return <small className="pw-proof-references">{ids.map((id,index)=>{
    const proof=run.evidence?.find(item=>item.evidence_id===id);
    const event=run.events?.find(item=>item.data?.evidence_id===id);
    const url=proof?.url??event?.data?.url;
    const label=proof?.source_name??event?.source_id??'Preuve collectée';
    return <span key={id}>{index>0?' · ':''}{url?<a href={safeSourceUrl(url)} target="_blank" rel="noreferrer">{label}</a>:<a href={`#proof-${id}`}>{label}</a>}</span>;
  })}</small>;
}

function parseContent(proof:ResearchEvidence):Record<string,unknown> {
  let value=proof.content;
  for(let attempt=0;attempt<4;attempt++) {
    if(typeof value==='string') {try{value=JSON.parse(value);}catch{return {excerpt:value};}}
    else break;
  }
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}

function EvidenceList({run}:{run:ResearchRun}) {
  return <section aria-label="Preuves collectées"><h4>Sources et documents lus</h4>{run.evidence?.map(proof=>{
    const content=parseContent(proof);
    const documents=Array.isArray(content.documents)?content.documents as {title?:string;url?:string;excerpt?:string;form?:string;filingDate?:string}[]:[];
    return <details className="pw-proof" key={proof.evidence_id} id={`proof-${proof.evidence_id}`}>
      <summary>{proof.source_name??proof.source_id} · {documents.length?`${documents.length} documents lus`:'Preuve collectée'}</summary>
      {proof.url&&<a href={safeSourceUrl(proof.url)} target="_blank" rel="noreferrer">Consulter la source</a>}
      {proof.collected_at&&<p><small>Collectée le {new Date(proof.collected_at).toLocaleString('fr-FR')}</small></p>}
      {documents.map((document,index)=><details key={document.url??index}><summary>{document.title??`${document.form??'Document officiel'} ${document.filingDate??''}`}</summary>{document.url&&<a href={safeSourceUrl(document.url)} target="_blank" rel="noreferrer">Ouvrir le document</a>}<p className="pw-research-answer">{document.excerpt}</p></details>)}
      {!documents.length&&<p className="pw-research-answer">{typeof content.excerpt==='string'?content.excerpt:typeof content.scope==='string'?content.scope:proof.limits}</p>}
      {proof.limits&&<p><small>{proof.limits}</small></p>}
    </details>;
  })}</section>;
}

export function ResearchResultsTab({runs,onRefresh}:{runs:ResearchRun[];onRefresh:()=>void}) {
  return <div className="pw-research-tab">
    <div className="pw-research-actions"><span>Résultats du moteur de recherche AWS</span><button type="button" onClick={onRefresh}>Actualiser le suivi</button></div>
    {!runs.length&&<p>Aucune recherche lancée depuis cette conversation.</p>}
    {[...runs].reverse().map(run=>{
      const result=run.result;
      return <article className="pw-research-result" key={run.analysis_id}>
        <header><h3>{run.question??'Analyse d’entreprise'}</h3><span role="status">{labels[run.status]??run.status}</span></header>
        <small>Analyse · {run.analysis_id}</small>
        {run.trackingError&&<p role="status" className="pw-research-warning">{run.trackingError}</p>}
        {run.error&&<p role="alert" className="pw-research-warning">La recherche a échoué. Consultez son historique pour le détail technique.</p>}
        {!result&&!run.error&&!['failed','cancelled'].includes(run.status)&&<p>Le moteur prépare les preuves et la synthèse. Les résultats apparaîtront ici dès leur réception.</p>}
        {result&&<>
          {result.coverage&&<section className="pw-research-coverage" aria-label="Couverture de la demande">
            <h4>Couverture de la demande</h4>
            <p>Exécution : {result.execution_status==='completed'?'terminée':labels[run.status]??run.status} · Couverture : {result.coverage.status==='sufficient'?'critères de collecte remplis':'partielle'}</p>
            {result.coverage.window&&<p>Du {result.coverage.window.start} au {result.coverage.window.end} · {result.coverage.window.timezone}</p>}
            <ul>{result.coverage.checks?.map(check=><li key={check.id}>{check.status==='covered'?'Vérifié':'Manquant'} : {check.label}</li>)}</ul>
          </section>}
          <h4>Synthèse</h4><p>{result.summary}</p>
          {result.sections?.length?result.sections.map((section,index)=><section key={index}><h4>{section.title}</h4><p className="pw-research-answer">{section.text}</p><References ids={section.evidence_ids} run={run}/></section>):<p className="pw-research-answer">{result.answer}</p>}
          <details className="pw-proof"><summary>Constats et références ({result.claims?.length??0})</summary><ul>{result.claims?.map((claim,index)=><li key={index}><p>{claim.text}</p><small>{claimLabels[claim.claim_type??'']??claim.claim_type} · {claim.confidence==='supported'?'Étayé':claim.confidence==='partial'?'Partiellement étayé':'À vérifier'}</small><References ids={claim.evidence_ids??[]} run={run}/></li>)}</ul></details>
          {!!result.cautions?.length&&<><h4>Limites et informations manquantes</h4><ul>{result.cautions.map((caution,index)=><li key={index}>{caution}</li>)}</ul></>}
          {!!run.evidence?.length&&<EvidenceList run={run}/>}
        </>}
        {run.events_truncated&&<p className="pw-research-warning">La trace affichée est partielle.</p>}
        <a href={safeSourceUrl(`/app/analyses?analysis_id=${encodeURIComponent(run.analysis_id)}`)}>Ouvrir le module Analyses</a>
      </article>;
    })}
  </div>;
}
