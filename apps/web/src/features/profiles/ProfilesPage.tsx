import { researchAgents, usedSkills, terminalResearch } from './research-workspace';
import { ResearchResultsTab, SkillsUsedTab } from './components/ResearchWorkspaceTabs';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bot, FileText, GitBranch, ListChecks, Plus, X, PanelRight, ExternalLink, Sparkles, BookOpen, Layers, SlidersHorizontal } from 'lucide-react';
import { useDemoAccount } from '../../shared/DemoAccountContext';
import { authenticatedFetch } from '../../shared/auth';
import { fieldLabels, fieldOrder } from './profile-model';
import { demoPrompts } from './demo-prompts';
import { createLocalId, safeSourceUrl, profileApiBase, type AgentEvent, type Citation, type WorkspaceTab } from './profile-api';
import { useProfileWorkspace, type ChatMessage } from './useProfileWorkspace';
import { PromptBar } from './components/PromptBar';
import { StreamingAnswer } from './components/StreamingAnswer';
import { MessageScroller } from './components/MessageScroller';
import { MessageActions } from './components/message-actions';
import { ToolActivityFeed } from './components/ToolActivityFeed';
import { Subagent } from './components/subagent';
import { ResearchProgress } from './components/research-progress';
import { AskUserCard } from './components/AskUserCard';
import { AgentsWorkspace } from './components/AgentsWorkspace';
import { ProfileInspector } from './ProfileInspector';
import { ProfileWorkbench } from './ProfileWorkbench';
import { useProfileMemory } from './useProfileMemory';
import { AssistantChatPanel } from '../assistant/AssistantChatPanel';
import { SimulationResultTab } from '../assistant/SimulationResultTab';
import './profiles.css';

type ProfilesWorkspaceProps = { assistantMode?: boolean; initialPrompt?: string };

function ConversationOverview({ tabs, activeTab, sources, agents, tabsOpen, onToggleTabs, onOpenWorkspace, onSelectTab }: {
  tabs: WorkspaceTab[]; activeTab: string; sources: Citation[]; agents: AgentEvent[]; tabsOpen: boolean; onToggleTabs: () => void; onOpenWorkspace: () => void; onSelectTab: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown); document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, [open]);
  const runningAgents = agents.filter(agent => agent.status === 'running').length;
  const domain = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
  useEffect(() => { if (tabsOpen) setOpen(false); }, [tabsOpen]);
  return <div className="pw-overview-control" ref={root}>
    <button type="button" className="pw-overview-trigger" aria-expanded={open||tabsOpen} aria-controls="pw-conversation-overview" aria-label={tabsOpen?'Masquer les onglets':'Onglets, références et agents'} title={tabsOpen?'Masquer les onglets':'Onglets, références et agents'} onClick={() => tabsOpen ? onToggleTabs() : setOpen(value => !value)}>
      <SlidersHorizontal size={16}/>
    </button>
    {open && <section id="pw-conversation-overview" className="pw-overview-popover" aria-label="Résumé de la conversation">
      <header><div><strong>Conversation</strong><span>Onglets, références et agents</span></div><button type="button" aria-label="Fermer le résumé" onClick={() => setOpen(false)}><X size={15}/></button></header>
      <div className="pw-overview-section"><h3><Layers size={13}/> Onglets <span>{tabs.length}</span></h3>{tabs.length?<ul className="pw-overview-tabs">{tabs.map(tab => <li key={tab.id}><button type="button" className={tab.id === activeTab ? 'is-active' : ''} onClick={() => { onSelectTab(tab.id); setOpen(false); }}><span>{tab.title}</span><small>{tab.id === activeTab ? 'Actif' : tab.kind}</small></button></li>)}</ul>:<><p className="pw-overview-empty">Aucun onglet dans cette conversation.</p><button type="button" className="pw-overview-empty-action" onClick={()=>{setOpen(false);onOpenWorkspace();}}>Ouvrir l’espace de travail<ExternalLink size={12}/></button></>}</div>
      <div className="pw-overview-section"><h3><BookOpen size={13}/> Références utilisées <span>{sources.length}</span></h3>{sources.length ? <ul className="pw-overview-sources">{sources.map(source => <li key={source.id}><a href={safeSourceUrl(source.url)} target="_blank" rel="noopener noreferrer"><span><strong>{source.title}</strong><small>{domain(source.url)}</small></span><ExternalLink size={12}/></a></li>)}</ul> : <p className="pw-overview-empty">Aucune référence reçue dans cette conversation.</p>}</div>
      <div className="pw-overview-agent-count"><Bot size={15}/><span>Agents actifs</span><strong>{runningAgents}</strong></div>
    </section>}
  </div>;
}

function ProfilesWorkspace({ assistantMode = false, initialPrompt }: ProfilesWorkspaceProps) {
  const [tabsOpen,setTabsOpen]=useState(false);
  const [profileExpanded,setProfileExpanded]=useState(false);
  const [mobilePane,setMobilePane]=useState<'chat'|'profile'>('profile');
  const splitContainer=useRef<HTMLDivElement>(null);
  const [split,setSplit]=useState(()=>{try{const value=Number(localStorage.getItem('investoros.profile-split'));return value>=25&&value<=75?value:50;}catch{return 50;}});
  const [resizing,setResizing]=useState(false);
  const changeSplit=(value:number)=>{const next=Math.max(25,Math.min(75,value));setSplit(next);try{localStorage.setItem('investoros.profile-split',String(next));}catch{}};
  const resizeAt=(clientX:number)=>{const rect=splitContainer.current?.getBoundingClientRect();if(rect)changeSplit((clientX-rect.left)/rect.width*100);};
  const location = useLocation();
  const navigate = useNavigate();
  const {activeAccount}=useDemoAccount();
  const {attachResearch,refreshResearch,workspace,busy,activity,error,activeTab,setActiveTab,send,answerQuestions,stop,update,reset,conversations,conversationId,startNewConversation,openConversation}=useProfileWorkspace(activeAccount.id,assistantMode?'assistant':'profiles');
  const memory=useProfileMemory(activeAccount.id,{profile:workspace.profile,tabs:workspace.tabs,sources:workspace.sources??[]},(profile,tabs,sources)=>update(w=>assistantMode?({...w,profile}):({...w,profile,tabs,sources})),assistantMode);
  const changeProfile=(key:import('./profile-model').FieldKey,value:string)=>update(w=>({...w,profile:{...w.profile,[key]:value,confirmed:false,version:(w.profile.version??1)+1,updatedAt:new Date().toISOString(),origins:{...w.profile.origins,[key]:'Modification directe'}}}));
  useEffect(()=>{const params=new URLSearchParams(location.search);const id=params.get('analysis_id');if(id&&/^[0-9a-f-]{36}$/i.test(id)){attachResearch(id);setTabsOpen(true);params.delete('analysis_id');navigate({pathname:location.pathname,search:params.toString()},{replace:true});}},[location.search,activeAccount.id]);
  const [input,setInput]=useState(''); const [connected,setConnected]=useState(false); const [model,setModel]=useState('');
  const handledInitialPrompt=useRef<string|null>(null);
  useEffect(()=>{
    if(!initialPrompt||busy||handledInitialPrompt.current===location.key)return;
    handledInitialPrompt.current=location.key;
    setInput('');
    navigate({pathname:location.pathname,search:location.search},{replace:true,state:null});
    void send(initialPrompt);
  },[initialPrompt,busy,location.key]);
  useEffect(()=>{const controller=new AbortController();authenticatedFetch(`${profileApiBase}/v1/profiles/status`,{signal:controller.signal}).then(r=>r.ok?r.json():Promise.reject()).then(data=>{setConnected(data.configured);setModel(data.modelId||'');}).catch(()=>setConnected(false));return()=>controller.abort();},[]);
  const submit=(text=input)=>{if(!text.trim()||busy)return;setMobilePane('chat');void send(text);setInput('');};
  const tab=workspace.tabs.find(t=>t.id===activeTab)||workspace.tabs[0];
  const addTab=()=>{const id=createLocalId();update(w=>({...w,tabs:[...w.tabs,{id,title:'Notes',kind:'note',content:''}]}));setActiveTab(id);if(assistantMode)setTabsOpen(true);};
  const closeTab=(id:string)=>{const remaining=workspace.tabs.filter(tab=>tab.id!==id);update(w=>({...w,tabs:w.tabs.filter(tab=>tab.id!==id)}));if(id===activeTab)setActiveTab(remaining[0]?.id??'');};
  const editTab=(patch:Partial<WorkspaceTab>)=>update(w=>({...w,tabs:w.tabs.map(t=>t.id===tab.id?{...t,...patch}:t)}));
  const regenerate=(m:ChatMessage)=>{const index=workspace.messages.findIndex(x=>x.id===m.id);const prompt=workspace.messages.slice(0,index).reverse().find(x=>x.role==='user');if(prompt&&!busy)void send(prompt.text,m.id);};
  const allTools=workspace.messages.flatMap(m=>m.tools);const allAgents=workspace.messages.flatMap(m=>m.agents);const allSources=[...(workspace.sources??[]),...workspace.messages.flatMap(m=>m.citations)].filter((s,i,a)=>a.findIndex(x=>x.url===s.url)===i);
  const runs=workspace.researchRuns??[];const combinedAgents=[...allAgents,...researchAgents(runs)];const skills=usedSkills(allTools,allAgents,runs);
  const pendingQuestion=workspace.messages.slice().reverse().find(m=>m.questionRequest&&!m.questionAnswer&&!m.questionDismissed);
  useEffect(()=>{if(pendingQuestion)setMobilePane('chat');else if(workspace.profileView)setMobilePane('profile');},[workspace.profileView,pendingQuestion?.id]);
  const renderMessage=(item:{id:string})=>{
    const m=workspace.messages.find(x=>x.id===item.id)!;
    if(m.role==='user')return <div className="pw-user-message">{m.text}</div>;
    const text=m.versions[m.version]??m.text;
    return <article className="pw-answer" data-ui-message="">
      <ToolActivityFeed tools={m.tools} runs={runs} active={busy&&m===workspace.messages.at(-1)} onOpenResearch={()=>{setActiveTab('research-results');setTabsOpen(true);}}/>
      {m.agents.map(a=><Subagent key={a.id} name={a.name} status={a.status} task={a.task} summary={a.summary} activity={a.status==='running'?'Consultation du spécialiste Bedrock':undefined} startedAt={a.startedAt} durationMs={a.durationMs}/>)}
      {m.tools.some(tool=>['start_analysis','inspect_market_movements'].includes(tool.name)&&tool.status==='done')&&<button type="button" className="pw-view-research" onClick={()=>{setActiveTab('research-results');setTabsOpen(true);}}>Voir les résultats et le suivi<ExternalLink size={14}/></button>}
      <StreamingAnswer text={text} streaming={busy&&m===workspace.messages.at(-1)} citations={m.citations} followUps={m.questionRequest?[]:m.followUps} onFollowUp={p=>submit(p.label)}/>
      {m.questionRequest&&m.questionAnswer&&<AskUserCard key={m.questionRequest.id} request={m.questionRequest} answer={m.questionAnswer} disabled={busy||(!m.questionAnswer&&pendingQuestion?.id!==m.id)} onSubmit={answer=>{void answerQuestions(m.id,m.questionRequest!,answer);}}/>}
      {m.error&&<p className="pw-error" role="alert">{m.error}</p>}
      {text&&<MessageActions text={text} actions={['copy','regenerate','feedback']} onCopy={value=>{if(!navigator.clipboard&&value){const el=document.createElement("textarea");el.value=value;document.body.appendChild(el);el.select();document.execCommand("copy");el.remove();}}} versions={m.versions.length||1} version={m.version} onVersionChange={version=>update(w=>({...w,messages:w.messages.map(x=>x.id===m.id?{...x,version}:x)}))} onRegenerate={()=>regenerate(m)} regenerating={busy&&m===workspace.messages.at(-1)} onFeedback={(kind,reason)=>update(w=>({...w,messages:w.messages.map(x=>x.id===m.id?{...x,feedback:reason||kind}:x)}))}/>}
    </article>;
  };
  const reduceMotion=useReducedMotion();
  const landing=assistantMode&&workspace.messages.length===0;
  const promptComposer=<motion.div layout layoutId={assistantMode?"assistant-prompt":undefined} transition={{duration:reduceMotion?0:0.48,ease:[0.22,1,0.36,1]}} style={{width:"100%"}}>
    {pendingQuestion?.questionRequest&&<div className="pw-question-dock"><div className="pw-question-waiting" role="status">L’assistant attend votre réponse</div><AskUserCard key={pendingQuestion.questionRequest.id} request={pendingQuestion.questionRequest} disabled={busy} onSubmit={answer=>void answerQuestions(pendingQuestion.id,pendingQuestion.questionRequest!,answer)}/></div>}
    <PromptBar value={input} onChange={setInput} onSend={()=>submit()} busy={busy} onStop={stop} placeholder={pendingQuestion?'Ou répondez librement ici…':'Posez votre question…'}/>
  </motion.div>;
  return <section className="profiles-page pw-page" aria-label={assistantMode?'Assistant InvestorOS':'Espace de profil investisseur'}>
    {!assistantMode&&<nav className="pb-mobile-switch" aria-label="Espace mobile"><button type="button" aria-pressed={mobilePane==='chat'} onClick={()=>setMobilePane('chat')}><Bot size={15}/>Conversation</button><button type="button" aria-pressed={mobilePane==='profile'} onClick={()=>setMobilePane('profile')}><FileText size={15}/>Profil et analyses</button></nav>}
    <LayoutGroup id={`workspace-${activeAccount.id}-${assistantMode?"assistant":"profiles"}`}><div ref={splitContainer} style={{"--profile-split":`${split}%` } as CSSProperties} className={`pw-workspace${!assistantMode?' is-profile-route mobile-show-'+mobilePane:''}${resizing?" is-resizing":""}${!assistantMode&&profileExpanded?' is-profile-expanded':''}${assistantMode?' is-assistant-mode':''}${assistantMode&&landing?' is-landing':''}${assistantMode&&!tabsOpen?' is-panel-closed':' is-panel-open'}`}>
      <AssistantChatPanel
        status={busy?activity:pendingQuestion?'En attente de vos réponses':connected?'Amazon Bedrock':'Connexion à l’API nécessaire'}
        provider={connected?'Bedrock':'Hors connexion'}
        model={model}
        onReset={assistantMode?()=>{setTabsOpen(false);startNewConversation();}:reset}
        resetDisabled={busy}
        conversations={conversations}
        activeConversationId={conversationId}
        onSelectConversation={openConversation}
        assistantMode={assistantMode}
        landing={landing}
        showStatus
        workspaceOverview={assistantMode?<ConversationOverview tabs={workspace.tabs} activeTab={tab?.id??activeTab} sources={allSources} agents={combinedAgents} tabsOpen={tabsOpen} onToggleTabs={()=>setTabsOpen(false)} onOpenWorkspace={()=>setTabsOpen(true)} onSelectTab={id=>{setActiveTab(id);setTabsOpen(true);}}/>:undefined}
        composerClassName={pendingQuestion?'is-awaiting-answer':''}
        composer={promptComposer}
        error={error}
      >
        {workspace.messages.length===0?<div className={`pw-empty${assistantMode?' pw-assistant-landing':''}`}>
          {assistantMode?<>
            <div className="pw-landing-heading"><h2>Par où commencer&nbsp;?</h2><p>Posez une question sur un profil, un portefeuille ou une analyse.</p></div>
            <div className="pw-landing-composer">{promptComposer}</div>
            <div className="pw-landing-ideas" aria-label="Idées pour commencer">{demoPrompts(activeAccount.id).map(t=><button type="button" key={t} onClick={()=>submit(t)}><span>{t}</span><Plus size={15}/></button>)}</div>
          </>:<><Sparkles size={28}/><h2>Commençons par vos projets.</h2><p>Parlez de vos objectifs, de votre horizon ou d’une contrainte. L’assistant structure votre profil et organise ses résultats dans les onglets.</p><div>{['Aide-moi à préciser mon profil','Crée un plan pour construire mon profil','Demande un avis à un spécialiste du risque'].map(t=><button type="button" key={t} onClick={()=>submit(t)}>{t}<Plus size={14}/></button>)}</div></>}
        </div>:<MessageScroller className="pw-messages" messages={workspace.messages.map(m=>({id:m.id,content:m.text,from:m.role}))} renderMessage={renderMessage}/>}
      </AssistantChatPanel>
      {(!assistantMode||tabsOpen)&&<div className="pw-split-handle" role="separator" tabIndex={0} aria-label="Redimensionner le chat et les onglets" aria-orientation="vertical" aria-valuemin={25} aria-valuemax={75} aria-valuenow={Math.round(split)} aria-valuetext={`${Math.round(split)} % pour le chat`} title="Glissez pour redimensionner · Double-clic pour équilibrer"
        onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);setResizing(true);resizeAt(event.clientX);}}
        onPointerMove={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))resizeAt(event.clientX);}}
        onPointerUp={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);setResizing(false);}}
        onPointerCancel={()=>setResizing(false)} onLostPointerCapture={()=>setResizing(false)} onDoubleClick={()=>changeSplit(50)}
        onKeyDown={event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();changeSplit(event.key==='Home'?25:event.key==='End'?75:split+(event.key==='ArrowLeft'?-2:2));}}}
      ><span aria-hidden="true"/></div>}
      <section id="assistant-workspace-panel" className={`pw-inspector${!assistantMode?' pw-profile-panel':''}`} aria-label="Espace de travail partagé de l’assistant">
        {assistantMode&&<div className="pw-tab-bar" role="tablist" aria-label="Documents et activités">
          {workspace.tabs.map(t=><div className={`pw-tab${t.id===tab?.id?' is-active':''}`} key={t.id}><button type="button" role="tab" aria-selected={t.id===tab?.id} onClick={()=>setActiveTab(t.id)}>{t.kind==='agents'?<Bot size={14}/>:t.kind==='tasks'?<ListChecks size={14}/>:t.kind==='simulation'?<GitBranch size={14}/>:<FileText size={14}/>}<span>{t.title}</span></button><button type="button" aria-label={`Fermer ${t.title}`} onClick={()=>closeTab(t.id)}><X size={12}/></button></div>)}
          <button className="pw-add-tab" type="button" onClick={addTab} disabled={workspace.tabs.length>=12||busy} aria-label="Ajouter un onglet"><Plus size={16}/></button>
        </div>}
        <div className={`pw-inspector-content${tab?.id==='research-results'?' is-research-results':''}`} role="tabpanel" aria-label={tab?.title}>
          {!assistantMode?<ProfileWorkbench accountId={activeAccount.id} profile={workspace.profile} onChange={changeProfile} onConfirm={()=>update(w=>({...w,profile:{...w.profile,confirmed:true,version:w.profile.version+1,updatedAt:new Date().toISOString()}}))} onDiscuss={prompt=>submit(prompt)} tabs={workspace.tabs} onTab={newTab=>update(w=>({...w,tabs:[...w.tabs.filter(t=>t.id!==newTab.id),newTab]}))} sources={allSources} busy={busy} requestedView={workspace.profileView} memory={memory} onRemove={closeTab} renderDocument={document=>document.id==='research-results'?<ResearchResultsTab runs={runs} onRefresh={refreshResearch}/>:document.id==='research-skills'?<SkillsUsedTab skills={skills}/>:document.kind==='agents'?<AgentsWorkspace agents={combinedAgents} busy={busy} activity={activity}/>:null} expanded={profileExpanded} onExpand={()=>setProfileExpanded(v=>!v)}/>:<>
          {!tab&&<div className="pw-empty"><FileText size={28}/><h2>Les onglets de cette conversation</h2><p>Ajoutez des notes ou demandez une analyse dans ce chat.</p><div><button type="button" onClick={addTab}>Ajouter des notes<Plus size={14}/></button><button type="button" onClick={()=>{update(w=>({...w,tabs:[...w.tabs,{id:'profile',title:'Profil',kind:'profile',content:''}]}));setActiveTab('profile');setTabsOpen(true);}}>Ouvrir le profil<FileText size={14}/></button></div></div>}
          {tab&&<><div className="pw-document-heading"><PanelRight size={16}/><input aria-label="Titre de l’onglet" value={tab.title} onChange={e=>editTab({title:e.target.value})}/></div>
          {tab.id==='research-skills'?<SkillsUsedTab skills={skills}/>:tab.id==='research-results'?<ResearchResultsTab runs={runs} onRefresh={refreshResearch}/>:tab.kind==='profile'?<ProfileInspector profile={workspace.profile} onChange={changeProfile} onDiscuss={prompt=>submit(prompt)}/>:tab.kind==='simulation'?<SimulationResultTab content={tab.content}/>:tab.kind==='tasks'?<><ResearchProgress title={tab.title} variant="plain" status={busy?'running':allTools.length?'complete':'queued'} phase={allTools.some(t=>t.status==='running')?'reading':'writing'} phaseLabels={{planning:'Demande',searching:'Contexte',reading:'Outils',writing:'Réponse'}} plan={allTools.map(t=>({id:t.id,title:t.name,status:t.status==='done'?'done':t.status==='running'?'active':'skipped'}))} sourcesRead={allSources.length} sourcesFound={allSources.length} current={busy?{kind:'write',text:activity}:undefined} summary={allTools.length?`${allTools.filter(t=>t.status==='done').length} opérations terminées`:'Aucune tâche lancée'} onCancel={busy?stop:undefined}/><textarea className="pw-document" aria-label="Notes du plan" value={tab.content} onChange={e=>editTab({content:e.target.value})}/>{tab.items?.map(item=><div className="pw-task" key={item.id}><label><input type="checkbox" checked={item.status==='done'} onChange={e=>editTab({items:tab.items?.map(x=>x.id===item.id?{...x,status:e.target.checked?'done':'pending'}:x)})}/><span>{item.title}</span></label>{item.url&&(item.url.startsWith('/app/')?<Link to={item.url} aria-label={`Ouvrir le module pour ${item.title}`}><ExternalLink size={13}/>Ouvrir</Link>:<a href={safeSourceUrl(item.url)} target="_blank" rel="noreferrer"><ExternalLink size={13}/>Source</a>)}</div>)}</>:tab.kind==='agents'?<AgentsWorkspace agents={combinedAgents} busy={busy||runs.some(run=>!terminalResearch(run.status)&&!run.trackingError)} activity={busy?activity:'Recherche en cours sur AWS'}/>:tab.kind==='sources'?<div className="pw-source-list">{allSources.length?allSources.map(s=><a href={safeSourceUrl(s.url)} target="_blank" rel="noreferrer" key={s.id}><ExternalLink size={14}/><div><strong>{s.title}</strong><p>{s.snippet}</p><small>{s.url}</small></div></a>):<p className="pw-muted">Les sources consultées apparaîtront ici.</p>}</div>:<><textarea className="pw-document" aria-label="Contenu de l’onglet" value={tab.content} onChange={e=>editTab({content:e.target.value})} placeholder="Écrivez ici ou demandez à l’assistant de remplir cet onglet…"/>{tab.items?.map(item=><label className="pw-task" key={item.id}><input type="checkbox" checked={item.status==='done'} onChange={e=>editTab({items:tab.items?.map(x=>x.id===item.id?{...x,status:e.target.checked?'done':'pending'}:x)})}/><span>{item.title}</span>{item.url&&<a href={safeSourceUrl(item.url)} target="_blank" rel="noreferrer">Source</a>}</label>)}</>}</>}
          </>}
        </div>
        {assistantMode&&<footer className="pw-inspector-footer">{busy?'L’assistant met à jour votre espace…':'Modifiable par vous et par l’assistant'}<span>{workspace.tabs.length} onglets</span></footer>}
      </section>
    </div></LayoutGroup>
  </section>;
}

export function ProfilesPage() {
  return <ProfilesWorkspace />;
}

export function AssistantPage() {
  const location = useLocation();
  const state = location.state as { initialPrompt?: unknown } | null;
  return <ProfilesWorkspace assistantMode initialPrompt={typeof state?.initialPrompt === 'string' ? state.initialPrompt : undefined} />;
}
