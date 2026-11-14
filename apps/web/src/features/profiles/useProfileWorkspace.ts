import { type AskUserRequest, type AskUserAnswer, formatQuestionAnswer } from './question-model';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fieldOrder, initialProfiles, type Profile } from './profile-model';
import { createLocalId, sourceUrl, streamProfile, type AgentEvent, type Citation, type FollowUp, type ToolEvent, type WorkspaceTab } from './profile-api';
export type ChatMessage={id:string;role:'user'|'assistant';text:string;citations:Citation[];followUps:FollowUp[];tools:ToolEvent[];agents:AgentEvent[];versions:string[];version:number;feedback?:string|null;error?:string;questionRequest?:AskUserRequest;questionAnswer?:AskUserAnswer;questionDismissed?:boolean};
type Workspace={profile:Profile;tabs:WorkspaceTab[];messages:ChatMessage[]};
const activeTabKey=(id:string,view:string)=>`investoros.workspace.active-tab.v1.${id}.${view}`;
const initial=(id:string):Workspace=>({profile:initialProfiles[id],tabs:[{id:'profile',title:'Profil',kind:'profile',content:''},{id:'tasks',title:'Tâches',kind:'tasks',content:'Les tâches de l’assistant apparaîtront ici.'},{id:'agents',title:'Agents',kind:'agents',content:''}],messages:[]});
function read(id:string):Workspace {try {const raw=JSON.parse(localStorage.getItem(`investoros.workspace.v2.${id}`)||'null'); if(raw?.profile&&Array.isArray(raw.tabs)&&Array.isArray(raw.messages))return raw;}catch{} return initial(id);}
function readActiveTab(id:string,workspace:Workspace,view:string) {try {const stored=localStorage.getItem(activeTabKey(id,view));if(stored&&workspace.tabs.some(tab=>tab.id===stored))return stored;}catch{}return workspace.tabs.find(tab=>tab.id===(view==='assistant'?'tasks':'profile'))?.id??workspace.tabs[0]?.id??'profile';}
export function useProfileWorkspace(accountId:string,view:'assistant'|'profiles'='profiles') {
  const [workspace,setWorkspace]=useState(()=>read(accountId)); const [busy,setBusy]=useState(false); const [activity,setActivity]=useState(''); const [error,setError]=useState(''); const [activeTab,setActiveTabState]=useState(()=>readActiveTab(accountId,read(accountId),view));
  const abort=useRef<AbortController|null>(null); const currentAccount=useRef(accountId); const requestBusy=useRef(false);
  const setActiveTab=useCallback((id:string)=>{setActiveTabState(id);try{localStorage.setItem(activeTabKey(currentAccount.current,view),id);}catch{}},[view]);
  useEffect(()=>{abort.current?.abort(); requestBusy.current=false; currentAccount.current=accountId; const next=read(accountId);setWorkspace(next);setBusy(false);setError('');setActiveTabState(readActiveTab(accountId,next,view)); return ()=>abort.current?.abort();},[accountId,view]);
  const update=(fn:(w:Workspace)=>Workspace)=>setWorkspace(w=>{const next=fn(w);try{localStorage.setItem(`investoros.workspace.v2.${currentAccount.current}`,JSON.stringify(next));}catch{}return next;});
  const send=async(text:string,regenerateId?:string,questionReply?:{messageId:string;request:AskUserRequest;answer:AskUserAnswer})=>{
    if(requestBusy.current||!text.trim()) return; requestBusy.current=true; setBusy(true);setError('');setActivity('Connexion à Bedrock');
    let completed=false;
    const owner=accountId; const controller=new AbortController(); abort.current=controller; const id=regenerateId||createLocalId();
    const source=regenerateId?workspace.messages.slice(0,workspace.messages.findIndex(m=>m.id===regenerateId)):workspace.messages;
    const history=source.filter(m=>m.text&&!m.error).slice(-28).map(m=>({role:m.role,content:m.text}));
    if(regenerateId&&history.at(-1)?.role==='user')history.pop();
    update(w=>({...w,messages:regenerateId?w.messages.map(m=>m.id===id?{...m,text:'',tools:[],agents:[],citations:[],followUps:[],error:undefined,questionRequest:undefined,questionAnswer:undefined,questionDismissed:false}:m):[...w.messages.map(m=>!questionReply&&m.questionRequest&&!m.questionAnswer?{...m,questionDismissed:true}:m),{id:createLocalId(),role:'user',text,citations:[],followUps:[],tools:[],agents:[],versions:[],version:0},{id,role:'assistant',text:'',citations:[],followUps:[],tools:[],agents:[],versions:[],version:0}]}));
    const patch=(fn:(m:ChatMessage)=>ChatMessage)=>{if(currentAccount.current===owner)update(w=>({...w,messages:w.messages.map(m=>m.id===id?fn(m):m)}));};
    try {await streamProfile({message:text,history,profile:Object.fromEntries(fieldOrder.map(key=>[key,workspace.profile[key]])),tabs:workspace.tabs,accountId,...(questionReply?{questionRequest:questionReply.request,questionAnswer:questionReply.answer}:{})},controller.signal,event=>{
      if(currentAccount.current!==owner)return;
      if(event.type==='status')setActivity(String(event.label));
      if(event.type==='text')patch(m=>({...m,text:m.text+String(event.delta||'')}));
      if(event.type==='tool') {const tool=event as unknown as ToolEvent;patch(m=>({...m,tools:[...m.tools.filter(t=>t.id!==tool.id),tool]}));setActivity(tool.status==='running'?tool.name:'Préparation de la réponse');}
      if(event.type==='agent'){const agent=event as unknown as AgentEvent;patch(m=>({...m,agents:[...m.agents.filter(a=>a.id!==agent.id),agent]}));}
      if(event.type==='sources'){patch(m=>({...m,citations:(event.citations as Citation[]).map(c=>({...c,url:sourceUrl(c.url)}))}));}
      if(event.type==='questions')patch(m=>({...m,questionRequest:event.request as AskUserRequest,followUps:[]}));
      if(event.type==='followups')patch(m=>({...m,followUps:event.prompts as FollowUp[]}));
      if(event.type==='workspace') {update(w=>({...w,profile:{...w.profile,...event.profile as Record<string,string>,confirmed:false},tabs:event.tabs as WorkspaceTab[]})); const tabs=event.tabs as WorkspaceTab[];if(tabs.length)setActiveTab(tabs[tabs.length-1].id);}
      if(event.type==='error'){const message=String(event.message);setError(message);patch(m=>({...m,error:message}));}
      if(event.type==='done'){completed=true;patch(m=>({...m,versions:[...m.versions,m.text],version:m.versions.length}));if(questionReply)update(w=>({...w,messages:w.messages.map(m=>m.id===questionReply.messageId?{...m,questionAnswer:questionReply.answer}:m)}));}
    });}catch(e){if(currentAccount.current===owner){const message=controller.signal.aborted?'Génération arrêtée.':(e instanceof Error?e.message:'Connexion interrompue.');setError(message);patch(m=>({...m,error:message}));}}finally{if(currentAccount.current===owner){requestBusy.current=false;setBusy(false);setActivity('');}}
    return completed;
  };
  return {workspace,busy,activity,error,activeTab,setActiveTab,send,answerQuestions:(messageId:string,request:AskUserRequest,answer:AskUserAnswer)=>send(formatQuestionAnswer(request,answer),undefined,{messageId,request,answer}),stop:()=>abort.current?.abort(),update,reset:()=>{abort.current?.abort();update(()=>initial(accountId));setActiveTab(view==='assistant'?'tasks':'profile');}};
}
