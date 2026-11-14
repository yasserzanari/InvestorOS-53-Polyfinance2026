import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bot, FileText, ListChecks, Plus, X, PanelRight, ExternalLink, Sparkles } from 'lucide-react';
import { useDemoAccount } from '../../shared/DemoAccountContext';
import { fieldLabels, fieldOrder } from './profile-model';
import { createLocalId, safeSourceUrl, profileApiBase, type WorkspaceTab } from './profile-api';
import { useProfileWorkspace, type ChatMessage } from './useProfileWorkspace';
import type { ToolEvent } from './profile-api';
import { PromptBar } from './components/PromptBar';
import { StreamingAnswer } from './components/StreamingAnswer';
import { MessageScroller } from './components/MessageScroller';
import { MessageActions } from './components/message-actions';
import { LiveActivity } from './components/LiveActivity';
import { Subagent } from './components/subagent';
import { ThinkingPill } from './components/thinking-pill';
import { ResearchProgress } from './components/research-progress';
import { AskUserCard } from './components/AskUserCard';
import { AgentsWorkspace } from './components/AgentsWorkspace';
import { ProfileInspector } from './ProfileInspector';
import { AssistantChatPanel } from '../assistant/AssistantChatPanel';
import './profiles.css';

type ProfilesWorkspaceProps = { assistantMode?: boolean; initialPrompt?: string };

function toolSources(tool: ToolEvent) {
  if (!['analyze_demo_portfolio', 'analyze_demo_scenario'].includes(tool.name) || !tool.output || typeof tool.output !== 'object') return undefined;
  const output = tool.output as { portfolioName?: string; provenance?: { moduleUrl?: string } };
  const url = output.provenance?.moduleUrl;
  if (!url) return undefined;
  const safeUrl = safeSourceUrl(url);
  const label = tool.name === 'analyze_demo_scenario' ? 'Scénarios · ouvrir' : `${output.portfolioName ?? 'Portefeuille'} · ouvrir`;
  return safeUrl === '#' ? undefined : [{ name: label, url: safeUrl }];
}

function ProfilesWorkspace({ assistantMode = false, initialPrompt }: ProfilesWorkspaceProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const {activeAccount}=useDemoAccount();
  const {workspace,busy,activity,error,activeTab,setActiveTab,send,answerQuestions,stop,update,reset}=useProfileWorkspace(activeAccount.id,assistantMode?'assistant':'profiles');
  const [input,setInput]=useState(''); const [connected,setConnected]=useState(false); const [model,setModel]=useState('');
  useEffect(()=>{if(!initialPrompt||workspace.messages.length||busy)return;setInput('');void send(initialPrompt);navigate(location.pathname,{replace:true,state:null});},[initialPrompt,workspace.messages.length,busy]);
  useEffect(()=>{const controller=new AbortController();fetch(`${profileApiBase}/v1/profiles/status`,{signal:controller.signal}).then(r=>r.ok?r.json():Promise.reject()).then(data=>{setConnected(data.configured);setModel(data.modelId||'');}).catch(()=>setConnected(false));return()=>controller.abort();},[]);
  const submit=(text=input)=>{if(!text.trim()||busy)return;void send(text);setInput('');};
  const tab=workspace.tabs.find(t=>t.id===activeTab)||workspace.tabs[0];
  const addTab=()=>{const id=createLocalId();update(w=>({...w,tabs:[...w.tabs,{id,title:'Notes',kind:'note',content:''}]}));setActiveTab(id);};
  const editTab=(patch:Partial<WorkspaceTab>)=>update(w=>({...w,tabs:w.tabs.map(t=>t.id===tab.id?{...t,...patch}:t)}));
  const regenerate=(m:ChatMessage)=>{const index=workspace.messages.findIndex(x=>x.id===m.id);const prompt=workspace.messages.slice(0,index).reverse().find(x=>x.role==='user');if(prompt&&!busy)void send(prompt.text,m.id);};
  const allTools=workspace.messages.flatMap(m=>m.tools);const allAgents=workspace.messages.flatMap(m=>m.agents);const allSources=workspace.messages.flatMap(m=>m.citations).filter((s,i,a)=>a.findIndex(x=>x.url===s.url)===i);
  const pendingQuestion=workspace.messages.slice().reverse().find(m=>m.questionRequest&&!m.questionAnswer&&!m.questionDismissed);
  const renderMessage=(item:{id:string})=>{
    const m=workspace.messages.find(x=>x.id===item.id)!;
    if(m.role==='user')return <div className="pw-user-message">{m.text}</div>;
    const text=m.versions[m.version]??m.text;
    return <article className="pw-answer" data-ui-message="">
      {m.tools.length>0&&<LiveActivity busy={busy&&m===workspace.messages.at(-1)} label={busy?activity:'Activité du tour'} nodes={m.tools.map(t=>({id:t.id,type:'tool',primary:t.name==='ask_user'?'Question à préciser':t.name,toolName:t.name,status:t.status==='done'?'completed':t.status==='failed'?'failed':'running',args:t.input,details:[{text:JSON.stringify(t.output??t.error??'En cours')}],sources:toolSources(t)}))}/>}
      {m.agents.map(a=><Subagent key={a.id} name={a.name} status={a.status} task={a.task} summary={a.summary} activity={a.status==='running'?'Consultation du spécialiste Bedrock':undefined} startedAt={a.startedAt} durationMs={a.durationMs}/>)}
      <StreamingAnswer text={text} streaming={busy&&m===workspace.messages.at(-1)} citations={m.citations} followUps={m.questionRequest?[]:m.followUps} onFollowUp={p=>submit(p.label)}/>
      {m.questionRequest&&m.questionAnswer&&<AskUserCard key={m.questionRequest.id} request={m.questionRequest} answer={m.questionAnswer} disabled={busy||(!m.questionAnswer&&pendingQuestion?.id!==m.id)} onSubmit={answer=>{void answerQuestions(m.id,m.questionRequest!,answer);}}/>}
      {m.error&&<p className="pw-error" role="alert">{m.error}</p>}
      {text&&<MessageActions text={text} actions={['copy','regenerate','feedback']} onCopy={value=>{if(!navigator.clipboard&&value){const el=document.createElement("textarea");el.value=value;document.body.appendChild(el);el.select();document.execCommand("copy");el.remove();}}} versions={m.versions.length||1} version={m.version} onVersionChange={version=>update(w=>({...w,messages:w.messages.map(x=>x.id===m.id?{...x,version}:x)}))} onRegenerate={()=>regenerate(m)} regenerating={busy&&m===workspace.messages.at(-1)} onFeedback={(kind,reason)=>update(w=>({...w,messages:w.messages.map(x=>x.id===m.id?{...x,feedback:reason||kind}:x)}))}/>}
    </article>;
  };
  return <section className="profiles-page pw-page" aria-label={assistantMode?'Assistant InvestorOS':'Espace de profil investisseur'}>
    <div className="pw-workspace">
      <AssistantChatPanel
        status={busy?activity:pendingQuestion?'En attente de vos réponses':connected?'Amazon Bedrock':'Connexion à l’API nécessaire'}
        provider={connected?'Bedrock':'Hors connexion'}
        model={model}
        onReset={reset}
        resetDisabled={busy}
        activity={busy&&<><ThinkingPill width={156} height={32} label="En cours"/><span>{activity}</span></>}
        composerClassName={pendingQuestion?'is-awaiting-answer':''}
        composer={
          <>
            {pendingQuestion?.questionRequest && (
              <div className="pw-question-dock">
                <div className="pw-question-waiting" role="status">L’assistant attend votre réponse</div>
                <AskUserCard
                  key={pendingQuestion.questionRequest.id}
                  request={pendingQuestion.questionRequest}
                  disabled={busy}
                  onSubmit={(answer) => void answerQuestions(pendingQuestion.id, pendingQuestion.questionRequest!, answer)}
                />
              </div>
            )}
            <PromptBar
              value={input}
              onChange={setInput}
              onSend={() => submit()}
              busy={busy}
              onStop={stop}
              placeholder={pendingQuestion ? 'Ou répondez librement ici…' : 'Décrivez votre demande ou demandez une analyse…'}
            />
          </>
        }
        error={error}
      >
        {workspace.messages.length===0?<div className="pw-empty"><Sparkles size={28}/><h2>{assistantMode?'Que souhaitez-vous organiser ?':'Commençons par vos projets.'}</h2><p>{assistantMode?'Posez une question ou coordonnez les prochaines étapes entre les modules de votre espace. Les opérations disponibles et leurs résultats restent visibles dans les onglets.':'Parlez de vos objectifs, de votre horizon ou d’une contrainte. L’assistant structure votre profil et organise ses résultats dans les onglets.'}</p><div>{(assistantMode?['Aide-moi à organiser les priorités de mon espace','Prépare une analyse avec les données disponibles','Quelles informations manquent pour avancer ?']:['Aide-moi à préciser mon profil','Crée un plan pour construire mon profil','Demande un avis à un spécialiste du risque']).map(t=><button type="button" key={t} onClick={()=>submit(t)}>{t}<Plus size={14}/></button>)}</div></div>:<MessageScroller className="pw-messages" messages={workspace.messages.map(m=>({id:m.id,content:m.text,from:m.role}))} renderMessage={renderMessage}/>}
      </AssistantChatPanel>
      <section className="pw-inspector" aria-label="Espace de travail de l’assistant">
        <div className="pw-tab-bar" role="tablist" aria-label="Documents et activités">
          {workspace.tabs.map(t=><div className={`pw-tab${t.id===tab?.id?' is-active':''}`} key={t.id}><button type="button" role="tab" aria-selected={t.id===tab?.id} onClick={()=>setActiveTab(t.id)}>{t.kind==='agents'?<Bot size={14}/>:t.kind==='tasks'?<ListChecks size={14}/>:<FileText size={14}/>}<span>{t.title}</span></button>{t.id!=='profile'&&<button type="button" aria-label={`Fermer ${t.title}`} onClick={()=>{update(w=>({...w,tabs:w.tabs.filter(x=>x.id!==t.id)}));if(t.id===activeTab)setActiveTab('profile');}}><X size={12}/></button>}</div>)}
          <button className="pw-add-tab" type="button" onClick={addTab} disabled={workspace.tabs.length>=12||busy} aria-label="Ajouter un onglet"><Plus size={16}/></button>
        </div>
        <div className="pw-inspector-content" role="tabpanel" aria-label={tab?.title}>
          {tab&&<><div className="pw-document-heading"><PanelRight size={16}/><input aria-label="Titre de l’onglet" value={tab.title} onChange={e=>editTab({title:e.target.value})}/></div>
          {tab.kind==='profile'?<ProfileInspector profile={workspace.profile} onChange={(key,value)=>update(w=>({...w,profile:{...w.profile,[key]:value,confirmed:false}}))} onDiscuss={prompt=>submit(prompt)}/>:tab.kind==='tasks'?<><ResearchProgress title={tab.title} variant="plain" status={busy?'running':allTools.length?'complete':'queued'} phase={allTools.some(t=>t.status==='running')?'reading':'writing'} phaseLabels={{planning:'Demande',searching:'Contexte',reading:'Outils',writing:'Réponse'}} plan={allTools.map(t=>({id:t.id,title:t.name,status:t.status==='done'?'done':t.status==='running'?'active':'skipped'}))} sourcesRead={allSources.length} sourcesFound={allSources.length} current={busy?{kind:'write',text:activity}:undefined} summary={allTools.length?`${allTools.filter(t=>t.status==='done').length} opérations terminées`:'Aucune tâche lancée'} onCancel={busy?stop:undefined}/><textarea className="pw-document" aria-label="Notes du plan" value={tab.content} onChange={e=>editTab({content:e.target.value})}/>{tab.items?.map(item=><div className="pw-task" key={item.id}><label><input type="checkbox" checked={item.status==='done'} onChange={e=>editTab({items:tab.items?.map(x=>x.id===item.id?{...x,status:e.target.checked?'done':'pending'}:x)})}/><span>{item.title}</span></label>{item.url&&(item.url.startsWith('/app/')?<Link to={item.url} aria-label={`Ouvrir le module pour ${item.title}`}><ExternalLink size={13}/>Ouvrir</Link>:<a href={safeSourceUrl(item.url)} target="_blank" rel="noreferrer"><ExternalLink size={13}/>Source</a>)}</div>)}</>:tab.kind==='agents'?<AgentsWorkspace agents={allAgents} busy={busy} activity={activity}/>:tab.kind==='sources'?<div className="pw-source-list">{allSources.length?allSources.map(s=><a href={safeSourceUrl(s.url)} target="_blank" rel="noreferrer" key={s.id}><ExternalLink size={14}/><div><strong>{s.title}</strong><p>{s.snippet}</p><small>{s.url}</small></div></a>):<p className="pw-muted">Les sources consultées apparaîtront ici.</p>}</div>:<><textarea className="pw-document" aria-label="Contenu de l’onglet" value={tab.content} onChange={e=>editTab({content:e.target.value})} placeholder="Écrivez ici ou demandez à l’assistant de remplir cet onglet…"/>{tab.items?.map(item=><label className="pw-task" key={item.id}><input type="checkbox" checked={item.status==='done'} onChange={e=>editTab({items:tab.items?.map(x=>x.id===item.id?{...x,status:e.target.checked?'done':'pending'}:x)})}/><span>{item.title}</span>{item.url&&<a href={safeSourceUrl(item.url)} target="_blank" rel="noreferrer">Source</a>}</label>)}</>}</>}
        </div>
        <footer className="pw-inspector-footer">{busy?'L’assistant met à jour votre espace…':'Modifiable par vous et par l’assistant'}<span>{workspace.tabs.length} onglets</span></footer>
      </section>
    </div>
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
