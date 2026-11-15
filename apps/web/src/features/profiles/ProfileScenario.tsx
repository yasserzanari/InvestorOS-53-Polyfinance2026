import { useMemo, useState } from 'react';
import { GitBranch, SlidersHorizontal, BookOpen, TriangleAlert } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { parseSimulationProjection, simulationPointOffset, simulationHorizon, simulationEventOffset } from '../../shared/api';
import { ProjectionParameters } from '../assistant/ProjectionParameters';
import { safeSourceUrl } from './profile-api';
export function ProfileScenario({content,onChange}:{content:string;onChange:(content:string)=>void}){
 const [view,setView]=useState('summary');const [dirty,setDirty]=useState(false);
 const projection=useMemo(()=>{try{return parseSimulationProjection(JSON.parse(content));}catch{return null;}},[content]);
 if(!projection)return <p role="alert" className="pb-error">Résultat de scénario illisible. Relancez le calcul dans la conversation.</p>;
 const colors=['#3572dd','#c5913c','#21978e','#986ec3'];
 const data=projection.branches[0].path.map((point,i)=>({step:simulationPointOffset(point),...Object.fromEntries(projection.branches.map((b,j)=>['b'+j,b.path[i]?.medianPrice]))}));
 const unit=projection.timeUnit==='calendar_days'?'jours':'séances';
 return <div className="pb-scenario-compact">
  <div className="pb-context-chips"><span>{projection.ticker}</span><span>{projection.currency}</span><span>Départ : {projection.asOf}</span><span>{simulationHorizon(projection)} {unit}</span></div>
  <div className="pb-group-nav" role="group" aria-label="Détails du scénario">{[{id:'summary',label:'Synthèse',icon:GitBranch},{id:'parameters',label:'Paramètres',icon:SlidersHorizontal},{id:'method',label:'Méthode',icon:BookOpen}].map(v=><button key={v.id} disabled={dirty&&v.id!=='parameters'} aria-pressed={view===v.id} onClick={()=>setView(v.id)}><v.icon size={15}/>{v.label}</button>)}</div>
  {view==='summary'&&<>{dirty?<div className="pb-callout is-amber"><TriangleAlert size={20}/><div><h3>Recalcul nécessaire</h3><p>Les hypothèses ont changé.</p><button onClick={()=>setView('parameters')}>Revenir aux paramètres</button></div></div>:<>
   <div className="pb-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{top:8,right:16,bottom:0,left:0}}><XAxis dataKey="step" type="number" domain={[0,'dataMax']} tick={{fontSize:10}}/><YAxis domain={['auto','auto']} tick={{fontSize:10}}/><Tooltip formatter={v=>Number(v).toLocaleString('fr-CA',{maximumFractionDigits:2})}/><ReferenceLine x={simulationEventOffset(projection.branches[0])} stroke="#a6b5cc" strokeDasharray="4 4"/>{projection.branches.map((b,i)=><Line key={b.id} dataKey={'b'+i} name={b.title} stroke={colors[i]} dot={false} strokeWidth={2.5} isAnimationActive={false}/>)}</LineChart></ResponsiveContainer><small>Trajectoires médianes conditionnelles · {projection.currency} · {unit}</small></div>
   <div className="pb-table-wrap"><table><thead><tr><th>Hypothèse</th><th>Choc</th><th>10e centile</th><th>Médiane</th><th>90e centile</th></tr></thead><tbody>{projection.branches.map((b,i)=>{const last=b.path[b.path.length-1];const value=(v:number)=>v.toLocaleString('fr-CA',{maximumFractionDigits:2});return <tr key={b.id}><th><i style={{background:colors[i]}}/>{b.title}</th><td>{b.shockPct} %</td><td>{value(last.lowerPrice)}</td><td>{value(last.medianPrice)}</td><td>{value(last.upperPrice)}</td></tr>;})}</tbody></table></div>
   <div className="pb-help"><TriangleAlert size={17}/><div><strong>Une hypothèse, aucune promesse de rendement</strong><p>Les centiles décrivent le modèle historique conditionnel. Ils ne donnent pas une probabilité de résultat futur.</p></div></div>
  </>}</>}
  {view==='parameters'&&<div className="pb-scenario-parameters"><ProjectionParameters defaultOpen compact projection={projection} onDirtyChange={setDirty} onApply={result=>{onChange(JSON.stringify(result));setDirty(false);setView('summary');}}/></div>}
  {view==='method'&&<div className="pb-method pb-scenario-method"><h3>Comment lire ces résultats</h3><p>{projection.method}</p>{projection.limitations.map(l=><p key={l}>{l}</p>)}{projection.sourceUrl&&<a href={safeSourceUrl(projection.sourceUrl)} target="_blank" rel="noreferrer">Source : {projection.source}</a>}</div>}
 </div>;
}
