import { parseFinancialWidget, type FinancialWidgetData } from './components/financial-widgets';
import { authenticatedFetch } from '../../shared/auth';
import { toolActivityLabel } from './components/ToolActivityFeed';
import { researchTabs, terminalResearch, type ResearchRun } from './research-workspace';
import { type AskUserRequest, type AskUserAnswer, formatQuestionAnswer } from './question-model';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fieldOrder, initialProfiles, type Profile } from './profile-model';
import { createLocalId, sourceUrl, streamProfile, profileApiBase, type AgentEvent, type AssistantPlan, type Citation, type FollowUp, type ToolEvent, type WorkspaceTab } from './profile-api';
export type ChatMessage={id:string;role:'user'|'assistant';text:string;plan?:AssistantPlan;citations:Citation[];followUps:FollowUp[];tools:ToolEvent[];agents:AgentEvent[];versions:string[];version:number;feedback?:string|null;widgets?:FinancialWidgetData[];widgetVersions?:FinancialWidgetData[][];error?:string;questionRequest?:AskUserRequest;questionAnswer?:AskUserAnswer;questionDismissed?:boolean};
type Workspace={profile:Profile;tabs:WorkspaceTab[];messages:ChatMessage[];researchRuns?:ResearchRun[];activeTab?:string;conversationScoped?:boolean;profileView?:string;widgetSelection?:Pick<FinancialWidgetData,'view'|'period'>;sources?:Citation[]};
export type ConversationHistoryItem={id:string;title:string;lastUsedAt:number};
type StoredConversation=ConversationHistoryItem&{messages:ChatMessage[];tabs?:WorkspaceTab[];researchRuns?:ResearchRun[];activeTab?:string};
const legacyConversationsKey=(id:string)=>`investoros.conversations.v1.${id}`;
const legacyActiveKey=(id:string)=>`investoros.conversations.active.v1.${id}`;
const workspaceKey=(id:string)=>`investoros.workspace.v2.${id}`;
const initial=(id:string):Workspace=>({profile:initialProfiles[id],tabs:[],messages:[],researchRuns:[],activeTab:'',conversationScoped:true});
function read(id:string):Workspace {try {const raw=JSON.parse(localStorage.getItem(`investoros.workspace.v2.${id}`)||'null'); if(raw?.profile&&Array.isArray(raw.tabs)&&Array.isArray(raw.messages))return raw.conversationScoped?raw:{...raw,conversationScoped:true,tabs:raw.messages.length?raw.tabs.filter((tab:WorkspaceTab)=>tab.id!=='profile'):[],researchRuns:raw.messages.length?raw.researchRuns??[]:[],activeTab:''};}catch{} return initial(id);}
function legacyConversations(id:string,workspace:Workspace):StoredConversation[]{
  const result:StoredConversation[]=[];
  try {const raw=JSON.parse(localStorage.getItem(legacyConversationsKey(id))||'[]');if(Array.isArray(raw))for(const item of raw){if(item&&typeof item.id==='string'&&typeof item.title==='string'&&Array.isArray(item.messages))result.push({...item,lastUsedAt:Number(item.lastUsedAt)||Date.now()});}}catch{}
  if(workspace.messages.length&&!result.length){const first=workspace.messages.find(message=>message.role==='user')?.text||'Conversation précédente';result.push({id:`legacy-${createLocalId()}`,title:first.slice(0,72),lastUsedAt:Date.now(),messages:workspace.messages,tabs:workspace.tabs,researchRuns:workspace.researchRuns,activeTab:workspace.activeTab});}
  return result.slice(0,30);
}
function conversationPayload(item:StoredConversation){return {title:item.title||'Nouvelle conversation',lastUsedAt:item.lastUsedAt||Date.now(),messages:item.messages??[],tabs:item.tabs??[],researchRuns:item.researchRuns??[],activeTab:item.activeTab??''};}
function readActiveTab(workspace:Workspace) {return workspace.tabs.some(tab=>tab.id===workspace.activeTab)?workspace.activeTab!:workspace.tabs[0]?.id??'';}
export function useProfileWorkspace(accountId:string,view:'assistant'|'profiles'='profiles') {
  const [workspace,setWorkspace]=useState(()=>initial(accountId)); const [busy,setBusy]=useState(false); const [activity,setActivity]=useState(''); const [error,setError]=useState(''); const [activeTab,setActiveTabState]=useState('');
  const [conversations,setConversations]=useState<ConversationHistoryItem[]>([]); const [conversationId,setConversationId]=useState('');
  const [historyReady,setHistoryReady]=useState(false); const [historyError,setHistoryError]=useState('');
  const abort=useRef<AbortController|null>(null); const currentAccount=useRef(accountId); const requestBusy=useRef(false);
  const currentConversation=useRef(conversationId);currentConversation.current=conversationId;
  const setActiveTab=useCallback((id:string)=>{setActiveTabState(id);setWorkspace(w=>({...w,activeTab:id}));},[]);
  useEffect(()=>{
    abort.current?.abort();requestBusy.current=false;currentAccount.current=accountId;
    const controller=new AbortController();let alive=true;
    setWorkspace(initial(accountId));setBusy(false);setError('');setHistoryError('');setHistoryReady(false);setConversations([]);setActiveTabState('');
    const migrateAndLoad=async()=>{
      try{
        const legacyWorkspace=read(accountId);const legacy=legacyConversations(accountId,legacyWorkspace);
        const endpoint=`${profileApiBase}/v1/profiles/conversations/${encodeURIComponent(accountId)}`;
        const response=await authenticatedFetch(endpoint,{signal:controller.signal});if(!response.ok)throw new Error(`Historique indisponible (${response.status}).`);
        const data=await response.json() as {conversations?:ConversationHistoryItem[]};const remote=Array.isArray(data.conversations)?data.conversations:[];const known=new Set(remote.map(item=>item.id));
        for(const item of legacy){if(!known.has(item.id)){const save=await authenticatedFetch(`${endpoint}/${encodeURIComponent(item.id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(conversationPayload(item)),signal:controller.signal});if(!save.ok)throw new Error(`Migration de l’historique interrompue (${save.status}).`);}}
        const activeStored=localStorage.getItem(legacyActiveKey(accountId))||'';
        const listResponse=await authenticatedFetch(endpoint,{signal:controller.signal});if(!listResponse.ok)throw new Error(`Historique indisponible (${listResponse.status}).`);
        const listData=await listResponse.json() as {conversations?:ConversationHistoryItem[]};const remoteItems=Array.isArray(listData.conversations)?listData.conversations:[];const items=[...remoteItems,...legacy.filter(item=>!remoteItems.some(saved=>saved.id===item.id)).map(({id,title,lastUsedAt})=>({id,title,lastUsedAt}))].sort((a,b)=>b.lastUsedAt-a.lastUsedAt).slice(0,30);
        const active=view==='profiles'?createLocalId():items.find(item=>item.id===activeStored)?.id??items[0]?.id??createLocalId();let loaded=initial(accountId);
        if(items.some(item=>item.id===active)){const detail=await authenticatedFetch(`${endpoint}/${encodeURIComponent(active)}`,{signal:controller.signal});if(!detail.ok)throw new Error(`La conversation sélectionnée est introuvable (${detail.status}).`);const stored=await detail.json() as StoredConversation;loaded={...loaded,messages:stored.messages??[],tabs:stored.tabs??[],researchRuns:stored.researchRuns??[],activeTab:stored.activeTab??'',conversationScoped:true};}
        if(!alive)return;
        localStorage.removeItem(legacyConversationsKey(accountId));localStorage.removeItem(legacyActiveKey(accountId));
        try{localStorage.setItem(workspaceKey(accountId),JSON.stringify({...legacyWorkspace,messages:[],tabs:[],researchRuns:[],activeTab:''}));}catch{}
        // Profile memory owns declarations and the Profile route's documents; history owns Assistant documents.
        setWorkspace(current=>({...loaded,profile:current.profile,...(view==='profiles'?{tabs:current.tabs,sources:current.sources}:{} )}));setActiveTabState(readActiveTab(loaded));setConversations(items);setConversationId(active);currentConversation.current=active;setHistoryReady(true);
      }catch(e){if(!alive||controller.signal.aborted)return;setHistoryError(e instanceof Error?e.message:'Synchronisation du compte impossible.');setHistoryReady(false);}
    };void migrateAndLoad();return()=>{alive=false;controller.abort();abort.current?.abort();};
  },[accountId,view]);
  const update=(fn:(w:Workspace)=>Workspace)=>setWorkspace(w=>fn(w));
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
    if(!historyReady||!conversationId||(!workspace.messages.length&&(view==='profiles'||!workspace.tabs.length)))return;
    const timer=window.setTimeout(()=>{
      const first=workspace.messages.find(message=>message.role==='user')?.text||'Nouvelle conversation';
      const item:StoredConversation={id:conversationId,title:first.replace(/\s+/g,' ').slice(0,72),lastUsedAt:Date.now(),messages:workspace.messages,tabs:view==='profiles'?[]:workspace.tabs,researchRuns:workspace.researchRuns,activeTab:view==='profiles'?'':activeTab};
      void authenticatedFetch(`${profileApiBase}/v1/profiles/conversations/${encodeURIComponent(accountId)}/${encodeURIComponent(conversationId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(conversationPayload(item))}).then(response=>{if(!response.ok)throw new Error(`Sauvegarde de l’historique impossible (${response.status}).`);if(currentAccount.current!==accountId)return;setHistoryError('');setConversations(previous=>[item,...previous.filter(entry=>entry.id!==conversationId)].slice(0,30));}).catch(e=>{if(currentAccount.current===accountId){setHistoryError(e instanceof Error?e.message:'Sauvegarde du compte impossible.');setHistoryReady(false);}});
    },700);return()=>window.clearTimeout(timer);
  },[accountId,historyReady,workspace.messages,workspace.tabs,workspace.researchRuns,activeTab,conversationId,view]);
  const saveCurrentConversation=async()=>{
    if(!conversationId||(!workspace.messages.length&&(view==='profiles'||!workspace.tabs.length)))return;
    const title=workspace.messages.find(message=>message.role==='user')?.text||'Nouvelle conversation';
    const item:StoredConversation={id:conversationId,title:title.replace(/\s+/g,' ').slice(0,72),lastUsedAt:Date.now(),messages:workspace.messages,tabs:view==='profiles'?[]:workspace.tabs,researchRuns:workspace.researchRuns,activeTab:view==='profiles'?'':activeTab};
    const response=await authenticatedFetch(`${profileApiBase}/v1/profiles/conversations/${encodeURIComponent(accountId)}/${encodeURIComponent(conversationId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(conversationPayload(item))});
    if(!response.ok)throw new Error(`Sauvegarde de l’historique impossible (${response.status}).`);
    setConversations(previous=>[item,...previous.filter(entry=>entry.id!==conversationId)].slice(0,30));
  };
  const startNewConversation=useCallback(()=>{
    if(requestBusy.current||!historyReady)return;
    void (async()=>{try{await saveCurrentConversation();const nextId=createLocalId();setConversationId(nextId);currentConversation.current=nextId;forcedResearch.current.clear();update(w=>({...w,messages:[],tabs:view==='profiles'?w.tabs:[],sources:view==='profiles'?w.sources:[],researchRuns:[],activeTab:view==='profiles'?w.activeTab:'',widgetSelection:undefined}));setActiveTabState(view==='profiles'?activeTab:'');setError('');setHistoryError('');}catch(e){setHistoryError(e instanceof Error?e.message:'Sauvegarde du compte impossible.');setHistoryReady(false);}})();
  },[conversationId,workspace,activeTab,accountId,historyReady,view]);
  const openConversation=useCallback((id:string)=>{
    if(requestBusy.current||id===conversationId||!historyReady)return;
    const owner=accountId;const priorId=conversationId;
    void (async()=>{
      try{
        await saveCurrentConversation();
        const response=await authenticatedFetch(`${profileApiBase}/v1/profiles/conversations/${encodeURIComponent(owner)}/${encodeURIComponent(id)}`);
        if(!response.ok)throw new Error(`La conversation n’a pas pu être chargée (${response.status}).`);
        const target=await response.json() as StoredConversation;if(currentAccount.current!==owner)return;
        const conversationTabs=target.tabs??[];const tabs=view==='profiles'?workspace.tabs:conversationTabs;const selected=view==='profiles'?activeTab:(tabs.some(tab=>tab.id===target.activeTab)?target.activeTab!:tabs[0]?.id??'');
        currentConversation.current=id;setConversationId(id);forcedResearch.current.clear();
        update(w=>({...w,messages:target.messages??[],widgetSelection:undefined,tabs,researchRuns:target.researchRuns??[],activeTab:selected}));setActiveTabState(selected);setError('');setHistoryError('');
        const metadata={id,title:target.title,lastUsedAt:Date.now()};setConversations(previous=>[metadata,...previous.filter(item=>item.id!==id&&item.id!==priorId)].slice(0,30));
      }catch(e){if(currentAccount.current===owner){setHistoryError(e instanceof Error?e.message:'Chargement du compte impossible.');setHistoryReady(false);}}
    })();
  },[conversations,workspace,activeTab,conversationId,accountId,historyReady,view]);
  const send=async(text:string,regenerateId?:string,questionReply?:{messageId:string;request:AskUserRequest;answer:AskUserAnswer})=>{
    if(requestBusy.current||!text.trim()||!historyReady)return; requestBusy.current=true; setBusy(true);setError('');setActivity('Connexion à Bedrock');
    let completed=false;
    const owner=accountId; const controller=new AbortController(); abort.current=controller; const id=regenerateId||createLocalId();
    const source=regenerateId?workspace.messages.slice(0,workspace.messages.findIndex(m=>m.id===regenerateId)):workspace.messages;
    const history=source.filter(m=>m.text&&!m.error).slice(-28).map(m=>({role:m.role,content:m.text}));
    if(regenerateId&&history.at(-1)?.role==='user')history.pop();
    update(w=>({...w,messages:regenerateId?w.messages.map(m=>m.id===id?{...m,text:'',plan:undefined,widgets:[],tools:[],agents:[],citations:[],followUps:[],error:undefined,questionRequest:undefined,questionAnswer:undefined,questionDismissed:false}:m):[...w.messages.map(m=>!questionReply&&m.questionRequest&&!m.questionAnswer?{...m,questionDismissed:true}:m),{id:createLocalId(),role:'user',text,citations:[],followUps:[],tools:[],agents:[],versions:[],version:0},{id,role:'assistant',text:'',citations:[],followUps:[],tools:[],agents:[],versions:[],version:0}]}));
    const patch=(fn:(m:ChatMessage)=>ChatMessage)=>{if(currentAccount.current===owner)update(w=>({...w,messages:w.messages.map(m=>m.id===id?fn(m):m)}));};
    try {await streamProfile({message:text,workspaceMode:view,history,widgetContext:[...source.flatMap(m=>(m.widgetVersions?.[m.version]??m.widgets??[]).filter(widget=>widget.persona===owner).map(({view,period})=>({view,period}))),...(workspace.widgetSelection?[workspace.widgetSelection]:[])].slice(-5),profile:Object.fromEntries(fieldOrder.map(key=>[key,workspace.profile[key]])),tabs:workspace.tabs,accountId,...(questionReply?{questionRequest:questionReply.request,questionAnswer:questionReply.answer}:{})},controller.signal,event=>{
      if(currentAccount.current!==owner)return;
      if(event.type==='status')setActivity(String(event.label));
      if(event.type==='text')patch(m=>({...m,text:m.text+String(event.delta||'')}));
      if(event.type==='plan')patch(m=>({...m,plan:event.plan as AssistantPlan}));
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
              update(w=>({...w,tabs:[...w.tabs.filter(item=>item.id!==id),tab]}));
              setActiveTab(id);
              update(w=>({...w,profileView:'scenarios:'+createLocalId()+':'+id}));
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
      if(event.type==='financial_widget') {
        const widget=parseFinancialWidget(event.widget);
        if(!widget)patch(m=>({...m,error:'La carte reçue est invalide et ne peut pas être affichée. Réessayez la demande.'}));
        if(widget&&widget.persona===owner)patch(m=>({...m,widgets:[...(m.widgets??[]).filter(item=>item.id!==widget.id),widget].slice(-8)}));
      }
      if(event.type==='questions')patch(m=>({...m,questionRequest:event.request as AskUserRequest,followUps:[]}));
      if(event.type==='followups')patch(m=>({...m,followUps:event.prompts as FollowUp[]}));
      if(event.type==='profile_view')update(w=>{const previous=w.profileView?.split(':');const target=event.documentId??(event.view==='scenarios'&&previous?.[0]==='scenarios'?previous[2]:'')??'';return {...w,profileView:String(event.view)+':'+createLocalId()+':'+String(target)};});
      if(event.type==='workspace') {update(w=>{
        const fields=event.profile as Record<string,string>;
        const changed=fieldOrder.filter(key=>fields[key]!==undefined&&fields[key]!==w.profile[key]);
        const profile=changed.length?{...w.profile,...fields,confirmed:false,version:(w.profile.version??1)+1,updatedAt:new Date().toISOString(),origins:{...w.profile.origins,...Object.fromEntries(changed.map(key=>[key,'Conversation avec l’assistant']))}}:w.profile;
        return {...w,profile,tabs:w.researchRuns?.length?researchTabs(event.tabs as WorkspaceTab[]):event.tabs as WorkspaceTab[]};
      });}
      if(event.type==='error'){const message=String(event.message);setError(message);patch(m=>({...m,error:message}));}
      if(event.type==='done'){completed=true;patch(m=>({...m,versions:[...m.versions,m.text],widgetVersions:[...(m.widgetVersions??m.versions.map(()=>[])),m.widgets??[]],version:m.versions.length}));if(questionReply)update(w=>({...w,messages:w.messages.map(m=>m.id===questionReply.messageId?{...m,questionAnswer:questionReply.answer}:m)}));}
    });}catch(e){if(currentAccount.current===owner){const message=controller.signal.aborted?'Génération arrêtée.':(e instanceof Error?e.message:'Connexion interrompue.');setError(message);patch(m=>({...m,error:message}));}}finally{if(currentAccount.current===owner){requestBusy.current=false;setBusy(false);setActivity('');patch(m=>({...m,tools:m.tools.map(tool=>tool.status==='running'?{...tool,status:'failed',error:'Opération interrompue avant sa confirmation.',finishedAt:Date.now()}:tool)}));}}
    return completed;
  };
  const attachResearch=(analysisId:string)=>{
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(analysisId))return;
    update(w=>({...w,tabs:researchTabs(w.tabs),researchRuns:w.researchRuns?.some(run=>run.analysis_id===analysisId)?w.researchRuns:[...(w.researchRuns??[]),{analysis_id:analysisId,status:'loading'}]}));
    setActiveTab('research-results');
  };
  return {attachResearch,historyReady,historyError,refreshResearch:()=>{forcedResearch.current=new Set((workspace.researchRuns??[]).map(run=>run.analysis_id));setResearchRefresh(value=>value+1);},workspace,busy,activity,error,activeTab,setActiveTab,send,answerQuestions:(messageId:string,request:AskUserRequest,answer:AskUserAnswer)=>send(formatQuestionAnswer(request,answer),undefined,{messageId,request,answer}),stop:()=>abort.current?.abort(),update,conversations,conversationId,startNewConversation,openConversation,reset:()=>{abort.current?.abort();update(()=>initial(accountId));setActiveTab('');}};
}
