import { useEffect, useRef, useState } from 'react';
import { fieldOrder, initialProfiles, type Profile } from './profile-model';
import { createLocalId, sourceUrl, streamProfile, type AgentEvent, type Citation, type FollowUp, type ToolEvent, type WorkspaceTab } from './profile-api';
export type ChatMessage={id:string;role:'user'|'assistant';text:string;citations:Citation[];followUps:FollowUp[];tools:ToolEvent[];agents:AgentEvent[];versions:string[];version:number;feedback?:string|null;error?:string};
type Workspace={profile:Profile;tabs:WorkspaceTab[];messages:ChatMessage[]};
const initial=(id:string):Workspace=>({profile:initialProfiles[id],tabs:[{id:'profile',title:'Profil',kind:'profile',content:''},{id:'tasks',title:'Tâches',kind:'tasks',content:'Les tâches de l’assistant apparaîtront ici.'},{id:'agents',title:'Agents',kind:'agents',content:''}],messages:[]});
function read(id:string):Workspace {try {const raw=JSON.parse(localStorage.getItem(`investoros.workspace.v2.${id}`)||'null'); if(raw?.profile&&Array.isArray(raw.tabs)&&Array.isArray(raw.messages))return raw;}catch{} return initial(id);}
export function useProfileWorkspace(accountId:string) {
  const [workspace,setWorkspace]=useState(()=>read(accountId)); const [busy,setBusy]=useState(false); const [activity,setActivity]=useState(''); const [error,setError]=useState(''); const [activeTab,setActiveTab]=useState('profile');
  const abort=useRef<AbortController|null>(null); const currentAccount=useRef(accountId); const requestBusy=useRef(false);
  useEffect(()=>{abort.current?.abort(); requestBusy.current=false; currentAccount.current=accountId; setWorkspace(read(accountId));setBusy(false);setError('');setActiveTab('profile'); return ()=>abort.current?.abort();},[accountId]);
  const update=(fn:(w:Workspace)=>Workspace)=>setWorkspace(w=>{const next=fn(w);try{localStorage.setItem(`investoros.workspace.v2.${currentAccount.current}`,JSON.stringify(next));}catch{}return next;});
  const send=async(text:string,regenerateId?:string)=>{
    if(requestBusy.current||!text.trim()) return; requestBusy.current=true; setBusy(true);setError('');setActivity('Connexion à Bedrock');
    const owner=accountId; const controller=new AbortController(); abort.current=controller; const id=regenerateId||createLocalId();
    const source=regenerateId?workspace.messages.slice(0,workspace.messages.findIndex(m=>m.id===regenerateId)):workspace.messages;
    const history=source.filter(m=>m.text&&!m.error).slice(-28).map(m=>({role:m.role,content:m.text}));
    if(regenerateId&&history.at(-1)?.role==='user')history.pop();
    update(w=>({...w,messages:regenerateId?w.messages.map(m=>m.id===id?{...m,text:'',tools:[],agents:[],citations:[],followUps:[],error:undefined}:m):[...w.messages,{id:createLocalId(),role:'user',text,citations:[],followUps:[],tools:[],agents:[],versions:[],version:0},{id,role:'assistant',text:'',citations:[],followUps:[],tools:[],agents:[],versions:[],version:0}]}));
    const patch=(fn:(m:ChatMessage)=>ChatMessage)=>{if(currentAccount.current===owner)update(w=>({...w,messages:w.messages.map(m=>m.id===id?fn(m):m)}));};
    try {await streamProfile({message:text,history,profile:Object.fromEntries(fieldOrder.map(key=>[key,workspace.profile[key]])),tabs:workspace.tabs,accountId},controller.signal,event=>{
      if(currentAccount.current!==owner)return;
      if(event.type==='status')setActivity(String(event.label));
      if(event.type==='text')patch(m=>({...m,text:m.text+String(event.delta||'')}));
      if(event.type==='tool') {const tool=event as unknown as ToolEvent;patch(m=>({...m,tools:[...m.tools.filter(t=>t.id!==tool.id),tool]}));setActivity(tool.status==='running'?tool.name:'Préparation de la réponse');}
      if(event.type==='agent'){const agent=event as unknown as AgentEvent;patch(m=>({...m,agents:[...m.agents.filter(a=>a.id!==agent.id),agent]}));}
      if(event.type==='sources'){patch(m=>({...m,citations:(event.citations as Citation[]).map(c=>({...c,url:sourceUrl(c.url)}))}));}
      if(event.type==='followups')patch(m=>({...m,followUps:event.prompts as FollowUp[]}));
      if(event.type==='workspace') {update(w=>({...w,profile:{...w.profile,...event.profile as Record<string,string>,confirmed:false},tabs:event.tabs as WorkspaceTab[]})); const tabs=event.tabs as WorkspaceTab[];if(tabs.length)setActiveTab(tabs[tabs.length-1].id);}
      if(event.type==='error'){const message=String(event.message);setError(message);patch(m=>({...m,error:message}));}
      if(event.type==='done')patch(m=>({...m,versions:[...m.versions,m.text],version:m.versions.length}));
    });}catch(e){if(currentAccount.current===owner){const message=controller.signal.aborted?'Génération arrêtée.':(e instanceof Error?e.message:'Connexion interrompue.');setError(message);patch(m=>({...m,error:message}));}}finally{if(currentAccount.current===owner){requestBusy.current=false;setBusy(false);setActivity('');}}
  };
  return {workspace,busy,activity,error,activeTab,setActiveTab,send,stop:()=>abort.current?.abort(),update,reset:()=>{abort.current?.abort();update(()=>initial(accountId));setActiveTab('profile');}};
}
