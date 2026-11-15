import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, RefreshCw, Activity, ChartNoAxesCombined, CalendarDays, Globe2, Network, SlidersHorizontal } from 'lucide-react';
import { authenticatedFetch } from '../../shared/auth';
import { parseSimulationProjection, type SimulationProjection } from '../../shared/api';
import { profileApiBase, safeSourceUrl } from '../profiles/profile-api';
import type { ResearchRun } from '../profiles/research-workspace';
import { fullDate, preciseDate, sourceUrl, sourceTime } from '../analysis-interactions/presentation';
import { EventVisual } from '../analysis-interactions/EventVisual';
import { EventDetailDialog } from '../analysis-interactions/EventDetailDialog';
import { HistoryExplorer } from '../analysis-interactions/HistoryExplorer';
import type { ExplorationTarget } from '../analysis-interactions/types';
import { ChronologyView } from '../analysis-workspace/ChronologyView';
import { NetworkView } from '../analysis-workspace/NetworkView';
import type { AnalysisResult } from '../analysis-workspace/types';
import { SimulationWorkspace } from '../simulation-workspace/SimulationWorkspace';
import '../analysis-workspace/workspace.css';
import './journey.css';
import { ResearchActivity } from './ResearchActivity';
import { AnalysisDossier } from './AnalysisDossier';

export function decodeEvidence(input: unknown): Record<string, unknown> {
 let value=input;
 for(let i=0;i<5&&typeof value==='string';i++){try{value=JSON.parse(value);}catch{return {excerpt:value};}}
 return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
export function analysisTicker(run:ResearchRun):string|undefined {
 for(const proof of run.evidence??[]){const c=decodeEvidence(proof.content);if(typeof c.ticker==='string')return c.ticker.toUpperCase();if(Array.isArray(c.tickers)&&typeof c.tickers[0]==='string')return c.tickers[0].toUpperCase();}
 return undefined;
}
type View='company'|'events'|'map'|'dependencies'|'simulation'|'activity';
const views:Record<View,string>={company:'Entreprise',events:'Événements',map:'Carte',dependencies:'Dépendances',simulation:'Simulations',activity:'Activité'};
const viewIcons={company:ChartNoAxesCombined,events:CalendarDays,map:Globe2,dependencies:Network,simulation:SlidersHorizontal,activity:Activity};
export function AnalysisJourney({run,accountId,standalone=false,onRefresh,onViewChange}:{run:ResearchRun;accountId:string;standalone?:boolean;onRefresh?:()=>void;onViewChange?:(view:string)=>void}){
 const ticker=analysisTicker(run);const[view,setView]=useState<View>(run.result?'company':'activity');const[target,setTarget]=useState<ExplorationTarget|null>(null);
 const[network,setNetwork]=useState<Pick<AnalysisResult,'entities'|'relations'|'evidence'|'limitations'>|null>(null);const[networkError,setNetworkError]=useState('');
 const[projection,setProjection]=useState<SimulationProjection|null>(null);const[error,setError]=useState('');
 const[simulationSeed,setSimulationSeed]=useState<ExplorationTarget|null>(null);const viewChange=useRef(onViewChange);viewChange.current=onViewChange;
 useEffect(()=>{viewChange.current?.(view);},[view]);
 const storageKey=`investoros.analysis.simulation.v1.${accountId}.${run.analysis_id}`;
 useEffect(()=>{setProjection(null);setError('');try{const raw=localStorage.getItem(storageKey);if(raw){const cached=parseSimulationProjection(JSON.parse(raw));if(cached?.ticker===ticker)setProjection(cached);}}catch{/* Corrupt browser cache is not a simulation result. */}},[storageKey,ticker]);
 useEffect(()=>{if(!ticker)return;const controller=new AbortController();setNetwork(null);setNetworkError('');authenticatedFetch(`${profileApiBase}/v1/profiles/research-network/${encodeURIComponent(ticker)}`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error('Aucune relation vérifiée disponible pour ce titre.');return r.json();}).then(data=>{if(!controller.signal.aborted)setNetwork(data);}).catch(e=>{if(!controller.signal.aborted)setNetworkError(String(e.message));});return()=>controller.abort();},[ticker]);
 const events=useMemo(()=> (run.evidence??[]).flatMap(proof=>{
  const c=decodeEvidence(proof.content);const dated=Array.isArray(c.dated_events)?c.dated_events:[];
  const documents=Array.isArray(c.documents)?c.documents:[];
  return [...dated,...documents.filter(d=>d&&typeof d==='object'&&'published_at' in d)].flatMap((raw,index)=>{
   if(!raw||typeof raw!=='object')return[];const item=raw as Record<string,unknown>;
   const published=typeof item.published_at==='string'?Date.parse(item.published_at):NaN;const date=typeof item.date==='string'?item.date:Number.isFinite(published)?new Date(published).toISOString().slice(0,10):undefined;
   if(!date||!Number.isFinite(Date.parse(date)))return[];
   const timeLabel=typeof item.time==='string'?sourceTime(item.time,typeof c.timezone==='string'?c.timezone:'heure de la source'):typeof item.call_time_pt==='string'?`Conférence à ${sourceTime(item.call_time_pt,'Pacifique')}`:undefined;
   const dateLabel=timeLabel?`${fullDate(date)} · ${timeLabel}`:typeof item.published_at==='string'?`${preciseDate(item.published_at)} · publication`:fullDate(date);
   return [{metrics:[...(typeof item.call_time_pt==='string'?[{label:'Conférence annoncée',value:sourceTime(item.call_time_pt,'Pacifique')}]:[]),...(typeof item.release_time_pt==='string'?[{label:'Publication des résultats annoncée',value:sourceTime(item.release_time_pt,'Pacifique')}]:[])],dateKind:(typeof item.date==='string'?'scheduled':'published') as 'scheduled'|'published',publishedAt:typeof item.published_at==='string'?item.published_at:undefined,dateLabel,imageUrl:sourceUrl(typeof item.imageUrl==='string'?item.imageUrl:typeof item.image_url==='string'?item.image_url:undefined),id:`${proof.evidence_id}-${index}`,kind:'event' as const,title:String(item.title??proof.source_name??'Événement'),summary:String(item.excerpt??`Événement annoncé dans la source ${proof.source_name}. Le résultat futur et sa réaction de marché restent inconnus.`),date,ticker,analysisId:run.analysis_id,classification:'research' as const,source:{title:String(item.title??proof.source_name),url:safeSourceUrl(String(item.url??proof.url??'')),publisher:proof.source_name}}];
  });
 }).sort((a,b)=>a.date.localeCompare(b.date)),[run.evidence,run.analysis_id,ticker]);
 const mapResult:AnalysisResult|undefined=network?{schemaVersion:'1.0',analysisId:run.analysis_id,resultVersion:1,accountId,title:run.question??'',company:ticker??'',question:run.question??'',asOf:run.result?.coverage?.window?.start??events[0]?.date??new Date().toISOString().slice(0,10),horizonDays:7,currency:'USD',costUnit:'USD',provenance:'research',status:'partial',summary:run.result?.summary??'',...network,evidence:[...network.evidence,...events.map(e=>({id:e.id,title:e.title,url:e.source?.url??"",publisher:e.source?.publisher??"",publishedAt:e.date,excerpt:e.summary}))],scenarios:[],events:events.map(e=>({id:e.id,title:e.title,date:e.date!,entityIds:['nvda'],severity:'unknown',detail:e.summary,evidenceIds:[e.id]}))}:undefined;
 const saveProjection=(result:SimulationProjection)=>{setProjection(result);setError('');try{localStorage.setItem(storageKey,JSON.stringify(result));}catch{setError('Calcul disponible, mais le navigateur ne peut pas le conserver.');}};
 return <section className="aj-root" aria-label={`Parcours d’analyse ${ticker}`}>
  {!standalone&&<header className="aj-heading"><div><h3>{ticker||'Recherche'} · explorer l’analyse</h3><p>{run.result?.coverage?.window?`Période étudiée : ${fullDate(run.result.coverage.window.start)} au ${fullDate(run.result.coverage.window.end)}`:'Les dates et sources restent attachées à cette analyse.'}</p></div><div className="aj-heading-actions">{onRefresh&&<button type="button" className="aj-refresh" aria-label="Actualiser le suivi" title="Actualiser le suivi" onClick={onRefresh}><RefreshCw size={15}/></button>}<Link to={`/app/analyses?analysis_id=${encodeURIComponent(run.analysis_id)}`}>Agrandir <ExternalLink size={14}/></Link></div></header>}
  <nav className="aj-nav" aria-label="Explorer les résultats">{(Object.keys(views) as View[]).map(key=>{const Icon=viewIcons[key];return <button type="button" key={key} disabled={!ticker&&key!=='activity'} aria-pressed={view===key} onClick={()=>setView(key)}><Icon size={14}/>{views[key]}</button>;})}</nav>
  {view==='activity'&&<ResearchActivity run={run} canvas/>}
  {view==='company'&&ticker&&<><HistoryExplorer researchContext={{analysisId:run.analysis_id,accountId}} researchEvents={events} ticker={ticker} onExplore={setTarget} enableForecast projection={projection??undefined} onForecast={saveProjection} onSimulation={()=>setView('simulation')} analysis={{id:`analysis:${run.analysis_id}`,kind:'conclusion',title:`${ticker} · synthèse de l’analyse`,summary:[run.result?.summary,...(run.result?.sections??[]).filter(section=>/risque|surveillance/i.test(section.title)).map(section=>section.text)].filter(Boolean).join('\n\n'),classification:'research',analysisId:run.analysis_id}}/></>}
  {view==='events'&&<div className="aj-events">{events.length?events.map(e=><button type="button" key={e.id} onClick={()=>setTarget(e)}><EventVisual target={e} className={e.imageUrl?'has-image':''}/><span><time>{e.dateLabel||fullDate(e.date)}</time><strong>{e.title}</strong><small>{e.source?.publisher}</small></span><ExternalLink size={14}/></button>):<p>Aucun événement daté disponible dans les preuves de cette analyse.</p>}</div>}
  {(view==='map'||view==='dependencies')&&(mapResult?<>{view==='map'&&<p className="aj-map-note">Relations déclarées par l’entreprise. Repères de pays schématiques; les lignes ne représentent pas des routes de transport. Risques non évalués.</p>}{view==='map'?<ChronologyView result={mapResult} onExplore={setTarget}/>:<NetworkView result={mapResult} mode="dependencies" onExplore={setTarget}/>}<details><summary>Provenance et limites de la carte</summary>{network?.limitations.map(l=><p key={l}>{l}</p>)}</details></>:<p role="status">{networkError||'Chargement des relations vérifiées…'}</p>)}
  {view==='simulation'&&ticker&&<SimulationWorkspace key={storageKey} ticker={ticker} projection={projection} events={events} seed={simulationSeed} onProjectionChange={saveProjection} onExplore={setTarget}/>}
  {error&&<p role="status">{error}</p>}
  <EventDetailDialog target={target} events={events} run={run} ticker={ticker} onClose={()=>setTarget(null)} onSelectTarget={setTarget} onSimulate={selection=>{setSimulationSeed({...selection,id:`${selection.id}:${Date.now()}`});setView('simulation');setTarget(null);}} onDependencies={()=>{setView('dependencies');setTarget(null);}}/>

 </section>;
}

export function ConnectedAnalysis({analysisId,accountId}:{analysisId:string;accountId:string}){
 const[run,setRun]=useState<ResearchRun|null>(null);const[error,setError]=useState('');const[revision,setRevision]=useState(0);const[refreshing,setRefreshing]=useState(false);
 useEffect(()=>{const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;let attempts=0;setError('');
 const load=async()=>{setRefreshing(true);try{const response=await authenticatedFetch(`${profileApiBase}/v1/profiles/research/${encodeURIComponent(analysisId)}?accountId=${encodeURIComponent(accountId)}`,{signal:controller.signal});if(!response.ok)throw new Error(`Analyse indisponible (${response.status}).`);const data=await response.json() as ResearchRun;if(data.analysis_id!==analysisId)throw new Error('Identité de résultat incorrecte.');if(controller.signal.aborted)return;setRun(data);if(!['complete','completed','partial','failed','cancelled'].includes(data.status)){if(++attempts<40)timer=setTimeout(load,4000);else setError('Suivi mis en pause. Actualisez pour reprendre la lecture sans relancer l’analyse.');}}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Lecture impossible.');}finally{if(!controller.signal.aborted)setRefreshing(false);}};void load();return()=>{controller.abort();clearTimeout(timer);};},[analysisId,accountId,revision]);
 const refresh=()=>setRevision(r=>r+1);
 return run?<AnalysisDossier run={run} accountId={accountId} onRefresh={refresh} refreshing={refreshing} error={error}/>:error?<div className="ad-load-error" role="alert"><p>{error}</p><button type="button" onClick={refresh}><RefreshCw size={14}/>Réessayer</button></div>:<div className="ad-loading" role="status"><div/><div/><div/><p>Ouverture du dossier et de ses sources…</p></div>;
}
