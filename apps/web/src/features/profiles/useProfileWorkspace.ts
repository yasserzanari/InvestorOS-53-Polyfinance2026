import { authenticatedFetch } from '../../shared/auth';
import { toolActivityLabel } from './components/ToolActivityFeed';
import { researchTabs, terminalResearch, type ResearchRun } from './research-workspace';
import { type AskUserRequest, type AskUserAnswer, formatQuestionAnswer } from './question-model';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fieldOrder, initialProfiles, type Profile } from './profile-model';
import { createLocalId, sourceUrl, streamProfile, profileApiBase, type AgentEvent, type Citation, type FollowUp, type ToolEvent, type WorkspaceTab } from './profile-api';
export type ChatMessage={id:string;role:'user'|'assistant';text:string;citations:Citation[];followUps:FollowUp[];tools:ToolEvent[];agents:AgentEvent[];versions:string[];version:number;feedback?:string|null;error?:string;questionRequest?:AskUserRequest;questionAnswer?:AskUserAnswer;questionDismissed?:boolean};
type Workspace={profile:Profile;tabs:WorkspaceTab[];messages:ChatMessage[];researchRuns?:ResearchRun[];activeTab?:string;conversationScoped?:boolean;profileView?:string;sources?:Citation[]};
export type ConversationHistoryItem={id:string;title:string;lastUsedAt:number;messages:ChatMessage[];tabs?:WorkspaceTab[];researchRuns?:ResearchRun[];activeTab?:string};
const conversationsKey=(id:string)=>`investoros.conversations.v1.${id}`;
const activeConversationKey=(id:string)=>`investoros.conversations.active.v1.${id}`;
const initial=(id:string):Workspace=>({profile:initialProfiles[id],tabs:[],messages:[],researchRuns:[],activeTab:'',conversationScoped:true});
function read(id:string):Workspace {try {const raw=JSON.parse(localStorage.getItem(`investoros.workspace.v2.${id}`)||'null'); if(raw?.profile&&Array.isArray(raw.tabs)&&Array.isArray(raw.messages))return raw.conversationScoped?raw:{...raw,conversationScoped:true,tabs:raw.messages.length?raw.tabs.filter((tab:WorkspaceTab)=>tab.id!=='profile'):[],researchRuns:raw.messages.length?raw.researchRuns??[]:[],activeTab:''};}catch{} return initial(id);}
function readConversations(id:string,workspace:Workspace):ConversationHistoryItem[]{
  try {
    const raw=JSON.parse(localStorage.getItem(conversationsKey(id))||'[]');
    if(Array.isArray(raw)&&raw.length)return raw.filter((item):item is ConversationHistoryItem=>Boolean(item&&typeof item.id==='string'&&typeof item.title==='string'&&Array.isArray(item.messages))).slice(0,30);
  } catch {}
  if(!workspace.messages.length)return [];
  const first=workspace.messages.find(message=>message.role==='user')?.text||'Conversation précédente';
  return [{id:'legacy-'+createLocalId(),title:first.slice(0,72),lastUsedAt:Date.now(),messages:workspace.messages,tabs:workspace.tabs,researchRuns:workspace.researchRuns,activeTab:workspace.activeTab}];
}
function storeConversations(accountId:string,items:ConversationHistoryItem[]){try{localStorage.setItem(conversationsKey(accountId),JSON.stringify(items.slice(0,30)));}catch{}}
function readActiveTab(workspace:Workspace) {return workspace.tabs.some(tab=>tab.id===workspace.activeTab)?workspace.activeTab!:workspace.tabs[0]?.id??'';}
export function useProfileWorkspace(accountId:string,view:'assistant'|'profiles'='profiles') {
  const [workspace,setWorkspace]=useState(()=>read(accountId)); const [busy,setBusy]=useState(false); const [activity,setActivity]=useState(''); const [error,setError]=useState(''); const [activeTab,setActiveTabState]=useState(()=>readActiveTab(read(accountId)));
  const [conversations,setConversations]=useState<ConversationHistoryItem[]>(()=>readConversations(accountId,read(accountId)));
  const [conversationId,setConversationId]=useState(()=>{try{return localStorage.getItem(activeConversationKey(accountId))||createLocalId();}catch{return createLocalId();}});
  const abort=useRef<AbortController|null>(null); const currentAccount=useRef(accountId); const requestBusy=useRef(false);
  const currentConversation=useRef(conversationId);currentConversation.current=conversationId;
  const setActiveTab=useCallback((id:string)=>{setActiveTabState(id);setWorkspace(w=>{const next={...w,activeTab:id};try{localStorage.setItem(`investoros.workspace.v2.${currentAccount.current}`,JSON.stringify(next));}catch{}return next;});},[]);
  useEffect(()=>{abort.current?.abort(); requestBusy.current=false; currentAccount.current=accountId; const next=read(accountId);setWorkspace(next);setBusy(false);setError('');setActiveTabState(readActiveTab(next));const items=readConversations(accountId,next);setConversations(items);let active='';try{active=localStorage.getItem(activeConversationKey(accountId))||'';}catch{}if(!active)active=(next.messages.length||next.tabs.length?items[0]?.id:undefined)||createLocalId();try{localStorage.setItem(activeConversationKey(accountId),active);}catch{}currentConversation.current=active;setConversationId(active); return ()=>abort.current?.abort();},[accountId,view]);
  const update=(fn:(w:Workspace)=>Workspace)=>setWorkspace(w=>{const next=fn(w);try{localStorage.setItem(`investoros.workspace.v2.${currentAccount.current}`,JSON.stringify(next));}catch{}return next;});
  const [researchRefresh,setResearchRefresh]=useState(0);
  const forcedResearch=useRef(new Set<string>());
  const updateRef=useRef(update);updateRef.current=update;
  const researchKey=(workspace.researchRuns??[]).map(run=>`${run.analysis_id}:${run.status}`).join('|');
  useEffect(()=>{
    const owner=accountId;
    const chat=conversationId;
    const pending=new Set([...(workspace.researchRuns??[]).filter(run=>!terminalResearch(run.status)).map(run=>run.analysis_id),...forcedResearch.current]);
    forcedResearch.current.clear();
    if(!pending.size)return;
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;const attempts=new Map<string,number>();
    const deadline=Date.now()+180000;
    const poll=async()=>{
      for(const analysisId of [...pending]) {
        try {
          const response=await authenticatedFetch(`${profileApiBase}/v1/profiles/research/${encodeURIComponent(analysisId)}?accountId=${encodeURIComponent(owner)}`,{signal:controller.signal});
          if(!response.ok)throw new Error(`Suivi indisponible (${response.status}).`);
          const data=await response.json() as ResearchRun;
          if(data.analysis_id!==analysisId)throw new Error('Identifiant de recherche incohérent.');
          if(controller.signal.aborted||currentAccount.current!==owner||currentConversation.current!==chat)return;
          updateRef.current(w=>({...w,researchRuns:w.researchRuns?.map(run=>run.analysis_id===analysisId?{...run,...data,trackingError:undefined}:run)}));
          if(terminalResearch(data.status))pending.delete(analysisId);
          attempts.delete(analysisId);
        }catch(error){
          if(controller.signal.aborted||currentAccount.current!==owner||currentConversation.current!==chat)return;
          const count=(attempts.get(analysisId)??0)+1;attempts.set(analysisId,count);
          if(count>=3)pending.delete(analysisId);
          const trackingError=count>=3?'Suivi mis en pause. Actualisez pour reprendre sans relancer l’analyse.':error instanceof Error?error.message:'Suivi interrompu.';
          updateRef.current(w=>({...w,researchRuns:w.researchRuns?.map(run=>run.analysis_id===analysisId?{...run,trackingError}:run)}));
        }
      }
      if(controller.signal.aborted)return;
      if(pending.size&&Date.now()<deadline)timer=setTimeout(()=>void poll(),2500);
      else if(pending.size)updateRef.current(w=>({...w,researchRuns:w.researchRuns?.map(run=>pending.has(run.analysis_id)?{...run,trackingError:'Suivi mis en pause. Actualisez pour reprendre sans relancer l’analyse.'}:run)}));
    };
    void poll();return()=>{controller.abort();clearTimeout(timer);};
  },[accountId,conversationId,researchKey,researchRefresh]);
  useEffect(()=>{
    if((!workspace.messages.length&&!workspace.tabs.length)||!conversationId)return;
    const timer=window.setTimeout(()=>setConversations(previous=>{
      const first=workspace.messages.find(message=>message.role==='user')?.text||'Nouvelle conversation';
      const existing=previous.find(item=>item.id===conversationId);
      const item:ConversationHistoryItem={id:conversationId,title:first.replace(/\s+/g,' ').slice(0,72),lastUsedAt:existing?.lastUsedAt||Date.now(),messages:workspace.messages,tabs:workspace.tabs,researchRuns:workspace.researchRuns,activeTab};
      const next=[item,...previous.filter(entry=>entry.id!==conversationId)].slice(0,30);storeConversations(currentAccount.current,next);return next;
    }),250);
    return ()=>window.clearTimeout(timer);
  },[workspace.messages,workspace.tabs,workspace.researchRuns,activeTab,conversationId]);
  const startNewConversation=useCallback(()=>{
    if(requestBusy.current)return;
    const active=conversationId;
    if(workspace.messages.length||workspace.tabs.length){
      const first=workspace.messages.find(message=>message.role==='user')?.text||'Nouvelle conversation';
      const next=[{id:active,title:first.replace(/\s+/g,' ').slice(0,72),lastUsedAt:Date.now(),messages:workspace.messages,tabs:workspace.tabs,researchRuns:workspace.researchRuns,activeTab},...conversations.filter(item=>item.id!==active)].slice(0,30);
      setConversations(next);storeConversations(currentAccount.current,next);
    }
    const nextId=createLocalId();setConversationId(nextId);try{localStorage.setItem(activeConversationKey(currentAccount.current),nextId);}catch{}
    currentConversation.current=nextId;forcedResearch.current.clear();
    update(w=>({...w,messages:[],tabs:[],researchRuns:[],activeTab:''}));setActiveTabState('');setError('');
  },[conversationId,workspace,activeTab,conversations]);
  const openConversation=useCallback((id:string)=>{
    if(requestBusy.current||id===conversationId)return;
    const target=conversations.find(item=>item.id===id);if(!target)return;
    const now=Date.now();
    const current=workspace.messages.length||workspace.tabs.length?{id:conversationId,title:workspace.messages.find(message=>message.role==='user')?.text.replace(/\s+/g,' ').slice(0,72)||'Nouvelle conversation',lastUsedAt:now,messages:workspace.messages,tabs:workspace.tabs,researchRuns:workspace.researchRuns,activeTab}:null;
    const next=[{...target,lastUsedAt:now},...conversations.filter(item=>item.id!==id&&item.id!==conversationId),...(current&&current.id!==id?[current]:[])].slice(0,30);
    setConversations(next);storeConversations(currentAccount.current,next);setConversationId(id);try{localStorage.setItem(activeConversationKey(currentAccount.current),id);}catch{}
    currentConversation.current=id;forcedResearch.current.clear();
    const tabs=target.tabs??[];const selected=tabs.some(tab=>tab.id===target.activeTab)?target.activeTab!:tabs[0]?.id??'';
    update(w=>({...w,messages:target.messages,tabs,researchRuns:target.researchRuns??[],activeTab:selected}));setActiveTabState(selected);setError('');
  },[conversations,workspace,activeTab,conversationId]);
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
    try {await streamProfile({message:text,workspaceMode:view,history,profile:Object.fromEntries(fieldOrder.map(key=>[key,workspace.profile[key]])),tabs:workspace.tabs,accountId,...(questionReply?{questionRequest:questionReply.request,questionAnswer:questionReply.answer}:{})},controller.signal,event=>{
      if(currentAccount.current!==owner)return;
      if(event.type==='status')setActivity(String(event.label));
      if(event.type==='text')patch(m=>({...m,text:m.text+String(event.delta||'')}));
      if(event.type==='tool') {
        const tool=event as unknown as ToolEvent;
        patch(m=>{const previous=m.tools.find(item=>item.id===tool.id);return {...m,tools:[...m.tools.filter(t=>t.id!==tool.id),{...previous,...tool,startedAt:previous?.startedAt??Date.now(),...(tool.status!=='running'?{finishedAt:Date.now()}:{} )}]};});
        setActivity(tool.status==='running'?toolActivityLabel(tool.name):'Préparation de la réponse');
        if(tool.name==='start_analysis'&&tool.status==='done'&&tool.output&&typeof tool.output==='object') {
          const run=tool.output as ResearchRun;
          if(typeof run.analysis_id==='string'&&typeof run.status==='string') {
            update(w=>({...w,tabs:researchTabs(w.tabs),researchRuns:[...(w.researchRuns??[]).filter(item=>item.analysis_id!==run.analysis_id),{...run,question:run.question??text}]}));
            setActiveTab('research-results');
          }
        }
        if(tool.name==='inspect_market_movements'&&tool.status==='done'&&tool.output&&typeof tool.output==='object') {
          const result=tool.output as {analysisId?:unknown};
          if(typeof result.analysisId==='string'&&/^[0-9a-f-]{36}$/i.test(result.analysisId)) {
            const identifier=result.analysisId;
            update(w=>({...w,tabs:researchTabs(w.tabs),researchRuns:w.researchRuns?.some(run=>run.analysis_id===identifier)?w.researchRuns:[...(w.researchRuns??[]),{analysis_id:identifier,status:'loading'}]}));
            setActiveTab('research-results');
          }
        }
        if(tool.name==='load_skill'&&tool.status==='done')update(w=>({...w,tabs:researchTabs(w.tabs)}));
        if(['project_market_scenarios','estimate_market_trajectories'].includes(tool.name)&&tool.status==='done'&&tool.output&&typeof tool.output==='object') {
          const projection=tool.output as {ticker?:unknown;branches?:unknown};
          if(typeof projection.ticker==='string'&&Array.isArray(projection.branches)) {
            const id=`simulation-${projection.ticker.toLowerCase().replace(/[^a-z0-9_-]/g,'-')}`;
            const tab:WorkspaceTab={id,title:`Trajectoires · ${projection.ticker.toUpperCase()}`,kind:'simulation',content:JSON.stringify(tool.output)};
            const exists=workspace.tabs.some(item=>item.id===id);
            if(exists||workspace.tabs.length<12) {
              update(w=>({...w,tabs:w.tabs.some(item=>item.id===id)?w.tabs.map(item=>item.id===id?tab:item):[...w.tabs,tab]}));
              setActiveTab(id);
              update(w=>({...w,profileView:'scenarios:'+createLocalId()}));
            }
          }
        }
      }
      if(event.type==='agent'){const agent=event as unknown as AgentEvent;patch(m=>({...m,agents:[...m.agents.filter(a=>a.id!==agent.id),agent]}));}
      if(event.type==='sources'){
        const citations=(event.citations as Citation[]).map(c=>({...c,url:sourceUrl(c.url)}));
        patch(m=>({...m,citations}));
        update(w=>({...w,sources:[...(w.sources??[]).filter(c=>!citations.some(next=>next.id===c.id)),...citations].slice(-80)}));
      }
      if(event.type==='questions')patch(m=>({...m,questionRequest:event.request as AskUserRequest,followUps:[]}));
      if(event.type==='followups')patch(m=>({...m,followUps:event.prompts as FollowUp[]}));
      if(event.type==='profile_view')update(w=>({...w,profileView:String(event.view)+':'+createLocalId()+':'+String(event.documentId??'')}));
      if(event.type==='workspace') {update(w=>{
        const fields=event.profile as Record<string,string>;
        const changed=fieldOrder.filter(key=>fields[key]!==undefined&&fields[key]!==w.profile[key]);
        const profile=changed.length?{...w.profile,...fields,confirmed:false,version:(w.profile.version??1)+1,updatedAt:new Date().toISOString(),origins:{...w.profile.origins,...Object.fromEntries(changed.map(key=>[key,'Conversation avec l’assistant']))}}:w.profile;
        return {...w,profile,tabs:w.researchRuns?.length?researchTabs(event.tabs as WorkspaceTab[]):event.tabs as WorkspaceTab[]};
      });}
      if(event.type==='error'){const message=String(event.message);setError(message);patch(m=>({...m,error:message}));}
      if(event.type==='done'){completed=true;patch(m=>({...m,versions:[...m.versions,m.text],version:m.versions.length}));if(questionReply)update(w=>({...w,messages:w.messages.map(m=>m.id===questionReply.messageId?{...m,questionAnswer:questionReply.answer}:m)}));}
    });}catch(e){if(currentAccount.current===owner){const message=controller.signal.aborted?'Génération arrêtée.':(e instanceof Error?e.message:'Connexion interrompue.');setError(message);patch(m=>({...m,error:message}));}}finally{if(currentAccount.current===owner){requestBusy.current=false;setBusy(false);setActivity('');patch(m=>({...m,tools:m.tools.map(tool=>tool.status==='running'?{...tool,status:'failed',error:'Opération interrompue avant sa confirmation.',finishedAt:Date.now()}:tool)}));}}
    return completed;
  };
  const attachResearch=(analysisId:string)=>{
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(analysisId))return;
    update(w=>({...w,tabs:researchTabs(w.tabs),researchRuns:w.researchRuns?.some(run=>run.analysis_id===analysisId)?w.researchRuns:[...(w.researchRuns??[]),{analysis_id:analysisId,status:'loading'}]}));
    setActiveTab('research-results');
  };
  return {attachResearch,refreshResearch:()=>{forcedResearch.current=new Set((workspace.researchRuns??[]).map(run=>run.analysis_id));setResearchRefresh(value=>value+1);},workspace,busy,activity,error,activeTab,setActiveTab,send,answerQuestions:(messageId:string,request:AskUserRequest,answer:AskUserAnswer)=>send(formatQuestionAnswer(request,answer),undefined,{messageId,request,answer}),stop:()=>abort.current?.abort(),update,conversations,conversationId,startNewConversation,openConversation,reset:()=>{abort.current?.abort();update(()=>initial(accountId));setActiveTab('');}};
}
