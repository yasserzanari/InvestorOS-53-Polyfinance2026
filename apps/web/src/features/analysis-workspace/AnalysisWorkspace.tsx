import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ArrowLeft, Download, ExternalLink, GitBranch, Globe2, Layers, Plus, Upload } from 'lucide-react';
import { analysisViewRenderers } from './view-registry';
import { getAvailableViews, parseAnalysisResult } from './schema';
import { sampleAnalysis } from './sample';
import { downloadResult, readResults, resultStorageIssues, saveResult, type AnalysisTabRef } from './storage';
import type { ExploreHandler, ExplorationTarget } from '../analysis-interactions/types';
import { evidenceTarget, entityTarget, relationTarget, eventTarget, scenarioTarget, seriesPointTarget, viewNames, type AnalysisResult, type AnalysisView, type ViewContext } from './types';
import './workspace.css';
const requirements:Record<AnalysisView,string>={chronology:'un événement daté relié à un site géolocalisé',propagation:'une relation orientée de type impact',scenarios:'au moins deux scénarios comparables',dependencies:'une relation d’approvisionnement ou une alternative',simulator:'un modèle de sensibilité et un port identifié'};
const descriptions:Record<AnalysisView,string>={chronology:'Carte, routes et événements datés',propagation:'Chemins de transmission d’un risque',scenarios:'Comparaison des coûts, délais et service',dependencies:'Fournisseurs, composants et sites liés',simulator:'Hypothèses et calculs conditionnels'};
export function AnalysisWorkspace({accountId,reference,onOpen,onLibrary,onExplore,onTargets}:{accountId:string;reference:AnalysisTabRef;onLibrary:()=>void;onExplore?:ExploreHandler;onTargets?:(targets:ExplorationTarget[])=>void;onOpen:(result:AnalysisResult,view:AnalysisView,newTab?:boolean)=>void}){
 const [storageIssues,setStorageIssues]=useState(()=>resultStorageIssues(accountId));
 const [results,setResults]=useState(()=>readResults(accountId));const [error,setError]=useState('');const [paste,setPaste]=useState('');const [importOpen,setImportOpen]=useState(false);const file=useRef<HTMLInputElement>(null);const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{setResults(readResults(accountId));setStorageIssues(resultStorageIssues(accountId));const listener=()=>{setResults(readResults(accountId));setStorageIssues(resultStorageIssues(accountId));};window.addEventListener('investoros:analysis-results',listener);window.addEventListener('storage',listener);return()=>{window.removeEventListener('investoros:analysis-results',listener);window.removeEventListener('storage',listener);};},[accountId]);
 const result=results.find(r=>r.analysisId===reference.analysisId&&r.resultVersion===reference.resultVersion);
 useEffect(()=>{
  if(!onTargets)return;
  if(!result){onTargets([]);return;}
  const targets:ExplorationTarget[]=[
   {id:`${result.analysisId}:v${result.resultVersion}:summary`,kind:'conclusion',title:result.title,summary:result.summary,date:result.asOf,classification:result.provenance,analysisId:result.analysisId},
   ...result.events.map(item=>eventTarget(result,item)),...result.entities.map(item=>entityTarget(result,item)),...result.relations.map(item=>relationTarget(result,item)),...result.scenarios.map(item=>scenarioTarget(result,item)),...result.evidence.map(item=>evidenceTarget(result,item)),
   ...result.scenarios.flatMap(scenario=>scenario.series.map(point=>seriesPointTarget(scenarioTarget(result,scenario),scenario.label,point,result.costUnit))),
  ];
  onTargets(targets);
 },[result,onTargets]);
 const available=result?getAvailableViews(result):[];const view=reference.view&&available.includes(reference.view)?reference.view:available[0];
 const ingest=(input:unknown)=>{try{const parsed=saveResult(accountId,input);const v=getAvailableViews(parsed)[0];setError('');setImportOpen(false);if(v)onOpen(parsed,v);else setError('Résultat enregistré. Il manque des données pour ouvrir les vues graphiques.');}catch(e){setError(e instanceof Error?e.message:'Résultat invalide.');}};
 const importFile=async(e:ChangeEvent<HTMLInputElement>)=>{const f=e.target.files?.[0];if(!f)return;if(f.size>1500000){setError('Le fichier dépasse 1,5 Mo.');e.target.value='';return;}try{const content=await f.text();if(!mounted.current)return;ingest(JSON.parse(content));}catch{setError('Le fichier ne contient pas de JSON valide.');}e.target.value='';};
 return <section className="aw-root" aria-label="Visualisations d’analyse">
  <header className="aw-heading"><div><h2><Layers size={19}/>{result?result.company:'Visualisations d’analyse'}</h2><p>{result?result.title:'Ouvrez un résultat et explorez ses données dans votre espace de travail.'}</p></div><div className="aw-actions">{result&&<><button type="button" title="Choisir une autre analyse" onClick={onLibrary}><ArrowLeft size={15}/>Analyses</button><button type="button" onClick={()=>downloadResult(result)} aria-label="Exporter le résultat JSON"><Download size={16}/></button></>}<button type="button" onClick={()=>{setImportOpen(x=>!x);setError('');}}><Upload size={15}/>{result?'JSON':'Importer un résultat'}</button></div></header>
  {storageIssues.map((issue,index)=><p className="aw-storage-notice" role="status" key={`${issue.kind}-${index}`}>{issue.message}</p>)}
  {error&&<p className="aw-error" role="alert">{error}</p>}
  {importOpen&&<section className="aw-import"><label>Résultat structuré JSON<textarea maxLength={1500000} value={paste} onChange={e=>setPaste(e.target.value)} placeholder='{"schemaVersion":"1.0", ...}'/></label><div><button type="button" onClick={()=>file.current?.click()}><Upload size={14}/>Choisir un fichier</button><button type="button" className="aw-primary" onClick={()=>{try{ingest(JSON.parse(paste));}catch{setError('JSON invalide.');}}}>Valider et ouvrir</button><button type="button" onClick={()=>setImportOpen(false)}>Fermer</button></div></section>}
  <input ref={file} hidden type="file" accept=".json,application/json" onChange={importFile}/>
  {result&&view?<>
   <div className="aw-context"><span>{result.provenance==='illustrative'?'Exemple illustratif':'Résultat de recherche'} · v{result.resultVersion} · {new Date(result.asOf).toLocaleDateString('fr-CA',{timeZone:result.asOf.length===10?'UTC':'America/Toronto'})} · {result.costUnit}</span><span>{result.status==='partial'?'Collecte partielle':`${result.evidence.length} sources`}</span></div>
   <nav className="aw-view-tabs" aria-label="Vues de l’analyse">{(Object.keys(viewNames) as AnalysisView[]).map(v=><button type="button" key={v} aria-pressed={view===v} disabled={!available.includes(v)} title={available.includes(v)?descriptions[v]:`Pour cette vue : ${requirements[v]}.`} onClick={()=>onOpen(result,v)}>{viewNames[v]}</button>)}<button className="aw-detach" type="button" onClick={()=>onOpen(result,view,true)} title="Ouvrir cette vue dans un onglet séparé"><Plus size={14}/><span>Onglet</span></button></nav>
   <AnalysisPanels key={`${result.analysisId}-${result.resultVersion}`} result={result} view={view} available={available} onExplore={onExplore}/>
   <details className="aw-provenance"><summary>Sources, hypothèses et limites · {result.evidence.length} sources</summary><p>{result.summary}</p>{onExplore&&<button type="button" onClick={()=>onExplore({id:`${result.analysisId}:v${result.resultVersion}:summary`,kind:'conclusion',title:result.title,summary:result.summary,date:result.asOf,classification:result.provenance,analysisId:result.analysisId})}>Explorer la synthèse</button>}{(Object.keys(viewNames) as AnalysisView[]).filter(v=>!available.includes(v)).map(v=><p key={v}><strong>{viewNames[v]} indisponible :</strong> il manque {requirements[v]}.</p>)}{result.limitations.map(l=><p key={l}>{l}</p>)}{result.evidence.map(s=>onExplore?<button className="aw-source-button" type="button" key={s.id} onClick={()=>onExplore(evidenceTarget(result,s))}><ExternalLink size={12}/><span>{s.title} · {s.publisher} · {s.publishedAt}</span></button>:<a key={s.id} href={s.url} target="_blank" rel="noreferrer"><ExternalLink size={12}/><span>{s.title} · {s.publisher} · {s.publishedAt}</span></a>)}</details>
  </>:<div className="aw-library">
   {reference.analysisId&&!result&&<p role="status">Le résultat de cet onglet n’est pas présent dans ce navigateur. Importez sa version JSON ou rouvrez-le depuis l’historique connecté.</p>}
   <div className="aw-library-intro"><Globe2 size={28}/><h3>Une analyse, cinq façons de l’explorer</h3><p>Les vues s’activent selon les événements, relations, scénarios et modèles réellement fournis.</p></div>
   <div className="aw-view-catalog">{(Object.keys(viewNames) as AnalysisView[]).map(v=><article key={v}><GitBranch size={18}/><h4>{viewNames[v]}</h4><p>{descriptions[v]}</p><button type="button" onClick={()=>{try{const r=saveResult(accountId,{...sampleAnalysis,accountId});onOpen(r,v);}catch(e){setError(String(e));}}}>Voir la maquette interactive</button></article>)}</div>
   <section className="aw-saved"><h3>Résultats dans ce navigateur</h3>{results.length?results.map(r=><article key={`${r.analysisId}-${r.resultVersion}`}><div><strong>{r.company} · {r.title}</strong><p>{r.provenance==='illustrative'?'Illustratif':'Recherche'} · v{r.resultVersion} · {getAvailableViews(r).length} vues disponibles</p></div><button type="button" disabled={!getAvailableViews(r).length} onClick={()=>onOpen(r,getAvailableViews(r)[0])}>Ouvrir <ExternalLink size={13}/></button></article>):<p>Les résultats reçus par les outils de l’Assistant ou importés apparaîtront ici.</p>}</section>
   <details className="aw-contract"><summary>Informations à fournir par les agents</summary><p>Identité et version de l’analyse, compte, date d’arrêt, devise et unité; entités avec coordonnées vérifiées pour la carte; relations orientées et sourcées; événements datés; scénarios comparables; paramètres et méthode du simulateur. Chaque lien utilise les identifiants des entités et des preuves du même résultat.</p><button type="button" onClick={()=>downloadResult(parseAnalysisResult({...sampleAnalysis,accountId}))}><Download size={14}/>Télécharger le contrat illustré JSON</button></details>
  </div>}
 </section>;
}

// Keep visited panels mounted so switching tabs does not erase a user's filters,
// graph positions, map camera or unsaved scenario parameters.
function AnalysisPanels({result,view,available,onExplore}:{result:AnalysisResult;view:AnalysisView;available:AnalysisView[];onExplore?:ExploreHandler}) {
 const [visited,setVisited]=useState<AnalysisView[]>([view]);
 const contexts=useRef<Partial<Record<AnalysisView,ViewContext>>>({});
 const announce=(currentView:AnalysisView,context:ViewContext)=>{
   contexts.current[currentView]=context;
   if(currentView===view)window.dispatchEvent(new CustomEvent('investoros:analysis-view-context',{detail:{accountId:result.accountId,analysisId:result.analysisId,resultVersion:result.resultVersion,view:currentView,context}}));
 };
 useEffect(()=>announce(view,contexts.current[view]??{}),[view]);

 useEffect(()=>setVisited(current=>current.includes(view)?current:[...current,view]),[view]);
 return <div className="aw-view aw-panel-stack">{available.filter(v=>v===view||visited.includes(v)).map(v=>{
 const View=analysisViewRenderers[v];
 return <section key={v} className={`aw-view-panel${v===view?' is-visible':''}`} aria-label={viewNames[v]} aria-hidden={v!==view} inert={v!==view}><View result={result} onExplore={onExplore} onContextChange={context=>announce(v,context)}/></section>;
 })}</div>;
}
