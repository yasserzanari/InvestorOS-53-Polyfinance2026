import { type AskUserRequest, type AskUserAnswer, formatQuestionAnswer } from './question-model';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fieldOrder, initialProfiles, type Profile } from './profile-model';
import { createLocalId, sourceUrl, streamProfile, type AgentEvent, type Citation, type FollowUp, type ToolEvent, type WorkspaceTab } from './profile-api';
export type ChatMessage={id:string;role:'user'|'assistant';text:string;citations:Citation[];followUps:FollowUp[];tools:ToolEvent[];agents:AgentEvent[];versions:string[];version:number;feedback?:string|null;error?:string;questionRequest?:AskUserRequest;questionAnswer?:AskUserAnswer;questionDismissed?:boolean};
type Workspace={profile:Profile;tabs:WorkspaceTab[];messages:ChatMessage[]};
export type ConversationHistoryItem={id:string;title:string;lastUsedAt:number;messages:ChatMessage[]};
// The profile and the global Assistant are two entry points into one workspace.
// Keep the selected tab account-scoped too, so navigation never forks state.
const activeTabKey=(id:string)=>`investoros.workspace.active-tab.v2.${id}`;
const conversationsKey=(id:string)=>`investoros.conversations.v1.${id}`;
const activeConversationKey=(id:string)=>`investoros.conversations.active.v1.${id}`;
const initial=(id:string):Workspace=>({profile:initialProfiles[id],tabs:[{id:'profile',title:'Profil',kind:'profile',content:''},{id:'tasks',title:'Tâches',kind:'tasks',content:'Les tâches de l’assistant apparaîtront ici.'},{id:'agents',title:'Agents',kind:'agents',content:''}],messages:[]});
function read(id:string):Workspace {try {const raw=JSON.parse(localStorage.getItem(`investoros.workspace.v2.${id}`)||'null'); if(raw?.profile&&Array.isArray(raw.tabs)&&Array.isArray(raw.messages))return raw;}catch{} return initial(id);}
function readConversations(id:string,workspace:Workspace):ConversationHistoryItem[]{
  try {
    const raw=JSON.parse(localStorage.getItem(conversationsKey(id))||'[]');
    if(Array.isArray(raw))return raw.filter((item):item is ConversationHistoryItem=>Boolean(item&&typeof item.id==='string'&&typeof item.title==='string'&&Array.isArray(item.messages))).slice(0,30);
  } catch {}
  if(!workspace.messages.length)return [];
  const first=workspace.messages.find(message=>message.role==='user')?.text||'Conversation précédente';
  return [{id:'legacy-'+createLocalId(),title:first.slice(0,72),lastUsedAt:Date.now(),messages:workspace.messages}];
}
function storeConversations(accountId:string,items:ConversationHistoryItem[]){try{localStorage.setItem(conversationsKey(accountId),JSON.stringify(items.slice(0,30)));}catch{}}
function readActiveTab(id:string,workspace:Workspace,view:string) {
  try {
    const stored=localStorage.getItem(activeTabKey(id));
    if(stored&&workspace.tabs.some(tab=>tab.id===stored))return stored;
    // One-time migration from the earlier per-view selection without losing a
    // tab a user had open before the shared workspace shipped.
    const legacy=localStorage.getItem(`investoros.workspace.active-tab.v1.${id}.${view}`);
    if(legacy&&workspace.tabs.some(tab=>tab.id===legacy)){
      localStorage.setItem(activeTabKey(id),legacy);
      return legacy;
    }
  } catch {}
  const fallback=workspace.tabs.find(tab=>tab.id==='profile')?.id??workspace.tabs[0]?.id??'profile';
  try {localStorage.setItem(activeTabKey(id),fallback);} catch {}
  return fallback;
}
export function useProfileWorkspace(accountId:string,view:'assistant'|'profiles'='profiles') {
  const [workspace,setWorkspace]=useState(()=>read(accountId)); const [busy,setBusy]=useState(false); const [activity,setActivity]=useState(''); const [error,setError]=useState(''); const [activeTab,setActiveTabState]=useState(()=>readActiveTab(accountId,read(accountId),view));
  const [conversations,setConversations]=useState<ConversationHistoryItem[]>(()=>readConversations(accountId,read(accountId)));
  const [conversationId,setConversationId]=useState(()=>{try{return localStorage.getItem(activeConversationKey(accountId))||createLocalId();}catch{return createLocalId();}});
  const abort=useRef<AbortController|null>(null); const currentAccount=useRef(accountId); const requestBusy=useRef(false);
  const setActiveTab=useCallback((id:string)=>{setActiveTabState(id);try{localStorage.setItem(activeTabKey(currentAccount.current),id);}catch{}},[]);
  useEffect(()=>{abort.current?.abort(); requestBusy.current=false; currentAccount.current=accountId; const next=read(accountId);setWorkspace(next);setBusy(false);setError('');setActiveTabState(readActiveTab(accountId,next,view));const items=readConversations(accountId,next);setConversations(items);let active='';try{active=localStorage.getItem(activeConversationKey(accountId))||'';}catch{}if(!active&&next.messages.length){active=items[0]?.id||createLocalId();try{localStorage.setItem(activeConversationKey(accountId),active);}catch{}}setConversationId(active||createLocalId()); return ()=>abort.current?.abort();},[accountId,view]);
  const update=(fn:(w:Workspace)=>Workspace)=>setWorkspace(w=>{const next=fn(w);try{localStorage.setItem(`investoros.workspace.v2.${currentAccount.current}`,JSON.stringify(next));}catch{}return next;});
  useEffect(()=>{
    if(!workspace.messages.length||!conversationId)return;
    const timer=window.setTimeout(()=>setConversations(previous=>{
      const first=workspace.messages.find(message=>message.role==='user')?.text||'Nouvelle conversation';
      const existing=previous.find(item=>item.id===conversationId);
      const item:ConversationHistoryItem={id:conversationId,title:first.replace(/\s+/g,' ').slice(0,72),lastUsedAt:existing?.lastUsedAt||Date.now(),messages:workspace.messages};
      const next=[item,...previous.filter(entry=>entry.id!==conversationId)].slice(0,30);storeConversations(currentAccount.current,next);return next;
    }),250);
    return ()=>window.clearTimeout(timer);
  },[workspace.messages,conversationId]);
  const startNewConversation=useCallback(()=>{
    if(requestBusy.current)return;
    const active=conversationId;
    if(workspace.messages.length){
      const first=workspace.messages.find(message=>message.role==='user')?.text||'Nouvelle conversation';
      const next=[{id:active,title:first.replace(/\s+/g,' ').slice(0,72),lastUsedAt:Date.now(),messages:workspace.messages},...conversations.filter(item=>item.id!==active)].slice(0,30);
      setConversations(next);storeConversations(currentAccount.current,next);
    }
    const nextId=createLocalId();setConversationId(nextId);try{localStorage.setItem(activeConversationKey(currentAccount.current),nextId);}catch{}
    update(w=>({...w,messages:[]}));setError('');
  },[conversationId,workspace.messages,conversations]);
  const openConversation=useCallback((id:string)=>{
    if(requestBusy.current)return;
    const target=conversations.find(item=>item.id===id);if(!target)return;
    const now=Date.now();
    const current=workspace.messages.length?{id:conversationId,title:workspace.messages.find(message=>message.role==='user')?.text.replace(/\s+/g,' ').slice(0,72)||'Nouvelle conversation',lastUsedAt:now,messages:workspace.messages}:null;
    const next=[{...target,lastUsedAt:now},...conversations.filter(item=>item.id!==id&&item.id!==conversationId),...(current&&current.id!==id?[current]:[])].slice(0,30);
    setConversations(next);storeConversations(currentAccount.current,next);setConversationId(id);try{localStorage.setItem(activeConversationKey(currentAccount.current),id);}catch{}
    update(w=>({...w,messages:target.messages}));setError('');
  },[conversations,workspace.messages,conversationId]);
  const send=async(text:string,regenerateId?:string,questionReply?:{messageId:string;request:AskUserRequest;answer:AskUserAnswer})=>{
    if(requestBusy.current||!text.trim()) return; requestBusy.current=true; setBusy(true);setError('');setActivity('Connexion à Bedrock');
    let completed=false;
    const owner=accountId; const controller=new AbortController(); abort.current=controller; const id=regenerateId||createLocalId();
    const usedAt=Date.now();
    setConversations(previous=>{const existing=previous.find(item=>item.id===conversationId);if(!existing)return previous;const next=previous.map(item=>item.id===conversationId?{...item,lastUsedAt:usedAt}:item);storeConversations(currentAccount.current,next);return next;});
    const source=regenerateId?workspace.messages.slice(0,workspace.messages.findIndex(m=>m.id===regenerateId)):workspace.messages;
    const history=source.filter(m=>m.text&&!m.error).slice(-28).map(m=>({role:m.role,content:m.text}));
    if(regenerateId&&history.at(-1)?.role==='user')history.pop();
    update(w=>({...w,messages:regenerateId?w.messages.map(m=>m.id===id?{...m,text:'',tools:[],agents:[],citations:[],followUps:[],error:undefined,questionRequest:undefined,questionAnswer:undefined,questionDismissed:false}:m):[...w.messages.map(m=>!questionReply&&m.questionRequest&&!m.questionAnswer?{...m,questionDismissed:true}:m),{id:createLocalId(),role:'user',text,citations:[],followUps:[],tools:[],agents:[],versions:[],version:0},{id,role:'assistant',text:'',citations:[],followUps:[],tools:[],agents:[],versions:[],version:0}]}));
    const patch=(fn:(m:ChatMessage)=>ChatMessage)=>{if(currentAccount.current===owner)update(w=>({...w,messages:w.messages.map(m=>m.id===id?fn(m):m)}));};
    try {await streamProfile({message:text,history,profile:Object.fromEntries(fieldOrder.map(key=>[key,workspace.profile[key]])),tabs:workspace.tabs,accountId,...(questionReply?{questionRequest:questionReply.request,questionAnswer:questionReply.answer}:{})},controller.signal,event=>{
      if(currentAccount.current!==owner)return;
      if(event.type==='status')setActivity(String(event.label));
      if(event.type==='text')patch(m=>({...m,text:m.text+String(event.delta||'')}));
      if(event.type==='tool') {
        const tool=event as unknown as ToolEvent;
        patch(m=>({...m,tools:[...m.tools.filter(t=>t.id!==tool.id),tool]}));
        setActivity(tool.status==='running'?tool.name:'Préparation de la réponse');
        if(tool.name==='project_market_scenarios'&&tool.status==='done'&&tool.output&&typeof tool.output==='object') {
          const projection=tool.output as {ticker?:unknown;branches?:unknown};
          if(typeof projection.ticker==='string'&&Array.isArray(projection.branches)) {
            const id=`simulation-${projection.ticker.toLowerCase().replace(/[^a-z0-9_-]/g,'-')}`;
            const tab:WorkspaceTab={id,title:`Trajectoires · ${projection.ticker.toUpperCase()}`,kind:'simulation',content:JSON.stringify(tool.output)};
            const exists=workspace.tabs.some(item=>item.id===id);
            if(exists||workspace.tabs.length<12) {
              update(w=>({...w,tabs:w.tabs.some(item=>item.id===id)?w.tabs.map(item=>item.id===id?tab:item):[...w.tabs,tab]}));
              setActiveTab(id);
            }
          }
        }
      }
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
  return {workspace,busy,activity,error,activeTab,setActiveTab,send,answerQuestions:(messageId:string,request:AskUserRequest,answer:AskUserAnswer)=>send(formatQuestionAnswer(request,answer),undefined,{messageId,request,answer}),stop:()=>abort.current?.abort(),update,conversations,conversationId,startNewConversation,openConversation,reset:()=>{abort.current?.abort();update(()=>initial(accountId));setActiveTab('profile');}};
}
