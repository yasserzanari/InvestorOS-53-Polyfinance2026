import { useEffect, useState } from 'react';
import { Bot, FileText, ListChecks, Plus, RotateCcw, X, PanelRight, ExternalLink, Sparkles } from 'lucide-react';
import { useDemoAccount } from '../../shared/DemoAccountContext';
import { fieldLabels, fieldOrder } from './profile-model';
import { createLocalId, safeSourceUrl, profileApiBase, type WorkspaceTab } from './profile-api';
import { useProfileWorkspace, type ChatMessage } from './useProfileWorkspace';
import { PromptBar } from './components/PromptBar';
import { StreamingAnswer } from './components/StreamingAnswer';
import { MessageScroller } from './components/MessageScroller';
import { MessageActions } from './components/message-actions';
import { LiveActivity } from './components/LiveActivity';
import { Subagent } from './components/subagent';
import { ToolBrowser } from './components/tool-browser';
import { ThinkingPill } from './components/thinking-pill';
import { ResearchProgress } from './components/research-progress';
import { ProfileInspector } from './ProfileInspector';
import './profiles.css';

export function ProfilesPage() {
  const {activeAccount}=useDemoAccount();
  const {workspace,busy,activity,error,activeTab,setActiveTab,send,stop,update,reset}=useProfileWorkspace(activeAccount.id);
  const [input,setInput]=useState(''); const [connected,setConnected]=useState(false); const [model,setModel]=useState('');
  useEffect(()=>{const controller=new AbortController();fetch(`${profileApiBase}/v1/profiles/status`,{signal:controller.signal}).then(r=>r.ok?r.json():Promise.reject()).then(data=>{setConnected(data.configured);setModel(data.modelId||'');}).catch(()=>setConnected(false));return()=>controller.abort();},[]);
  const submit=(text=input)=>{if(!text.trim()||busy)return;void send(text);setInput('');};
  const tab=workspace.tabs.find(t=>t.id===activeTab)||workspace.tabs[0];
  const addTab=()=>{const id=createLocalId();update(w=>({...w,tabs:[...w.tabs,{id,title:'Notes',kind:'note',content:''}]}));setActiveTab(id);};
  const editTab=(patch:Partial<WorkspaceTab>)=>update(w=>({...w,tabs:w.tabs.map(t=>t.id===tab.id?{...t,...patch}:t)}));
  const regenerate=(m:ChatMessage)=>{const index=workspace.messages.findIndex(x=>x.id===m.id);const prompt=workspace.messages.slice(0,index).reverse().find(x=>x.role==='user');if(prompt&&!busy)void send(prompt.text,m.id);};
  const allAgents=workspace.messages.flatMap(m=>m.agents);const allTools=workspace.messages.flatMap(m=>m.tools);const allSources=workspace.messages.flatMap(m=>m.citations).filter((s,i,a)=>a.findIndex(x=>x.url===s.url)===i);
  const renderMessage=(item:{id:string})=>{
    const m=workspace.messages.find(x=>x.id===item.id)!;
    if(m.role==='user')return <div className="pw-user-message">{m.text}</div>;
    const text=m.versions[m.version]??m.text;
    return <article className="pw-answer" data-ui-message="">
      {m.tools.length>0&&<LiveActivity busy={busy&&m===workspace.messages.at(-1)} label={busy?activity:'Activité du tour'} nodes={m.tools.map(t=>({id:t.id,type:'tool',primary:t.name,toolName:t.name,status:t.status==='done'?'completed':t.status==='failed'?'failed':'running',args:t.input,details:[{text:JSON.stringify(t.output??t.error??'En cours')}]}))}/>}
      {m.agents.map(a=><Subagent key={a.id} name={a.name} status={a.status} task={a.task} summary={a.summary} activity={a.status==='running'?'Consultation du spécialiste Bedrock':undefined} startedAt={a.startedAt} durationMs={a.durationMs}/>)}
      <StreamingAnswer text={text} streaming={busy&&m===workspace.messages.at(-1)} citations={m.citations} followUps={m.followUps} onFollowUp={p=>submit(p.label)}/>
      {m.error&&<p className="pw-error" role="alert">{m.error}</p>}
      {text&&<MessageActions text={text} actions={['copy','regenerate','feedback']} onCopy={value=>{if(!navigator.clipboard&&value){const el=document.createElement("textarea");el.value=value;document.body.appendChild(el);el.select();document.execCommand("copy");el.remove();}}} versions={m.versions.length||1} version={m.version} onVersionChange={version=>update(w=>({...w,messages:w.messages.map(x=>x.id===m.id?{...x,version}:x)}))} onRegenerate={()=>regenerate(m)} regenerating={busy&&m===workspace.messages.at(-1)} onFeedback={(kind,reason)=>update(w=>({...w,messages:w.messages.map(x=>x.id===m.id?{...x,feedback:reason||kind}:x)}))}/>}
    </article>;
  };
  return <section className="profiles-page pw-page" aria-label="Espace de profil investisseur">
    <div className="pw-workspace">
      <section className="pw-chat" aria-label="Conversation avec l’assistant">
        <header className="pw-chat-header"><div className="pw-assistant-icon"><Sparkles size={18}/></div><div><strong>Assistant InvestorOS</strong><p>{busy?activity:connected?'Amazon Bedrock':'Connexion à l’API nécessaire'}</p></div><span title={model} className="pw-provider">{connected?'Bedrock':'Hors connexion'}</span><button type="button" className="pw-new-chat" onClick={reset} disabled={busy} aria-label="Nouvelle conversation" title="Réinitialiser le profil et la conversation"><RotateCcw size={15}/></button></header>
        {workspace.messages.length===0?<div className="pw-empty"><Sparkles size={28}/><h2>Commençons par vos projets.</h2><p>Parlez de vos objectifs, de votre horizon ou d’une contrainte. L’assistant structure votre profil et organise ses résultats dans les onglets.</p><div>{['Aide-moi à préciser mon profil','Crée un plan pour construire mon profil','Demande un avis à un spécialiste du risque'].map(t=><button type="button" key={t} onClick={()=>submit(t)}>{t}<Plus size={14}/></button>)}</div></div>:<MessageScroller className="pw-messages" messages={workspace.messages.map(m=>({id:m.id,content:m.text,from:m.role}))} renderMessage={renderMessage}/>}
        {busy&&<div className="pw-current-activity"><ThinkingPill width={156} height={32} label="En cours"/><span>{activity}</span></div>}
        <div className="pw-composer"><PromptBar value={input} onChange={setInput} onSend={()=>submit()} busy={busy} onStop={stop} placeholder="Décrivez votre projet ou demandez une analyse…"/><span>Profil et historique enregistrés dans ce navigateur. Les messages sont envoyés à Amazon Bedrock.</span>{error&&<p className="pw-error">{error}</p>}</div>
      </section>
      <section className="pw-inspector" aria-label="Espace de travail de l’assistant">
        <div className="pw-tab-bar" role="tablist" aria-label="Documents et activités">
          {workspace.tabs.map(t=><div className={`pw-tab${t.id===tab?.id?' is-active':''}`} key={t.id}><button type="button" role="tab" aria-selected={t.id===tab?.id} onClick={()=>setActiveTab(t.id)}>{t.kind==='agents'?<Bot size={14}/>:t.kind==='tasks'?<ListChecks size={14}/>:<FileText size={14}/>}<span>{t.title}</span></button>{t.id!=='profile'&&<button type="button" aria-label={`Fermer ${t.title}`} onClick={()=>{update(w=>({...w,tabs:w.tabs.filter(x=>x.id!==t.id)}));if(t.id===activeTab)setActiveTab('profile');}}><X size={12}/></button>}</div>)}
          <button className="pw-add-tab" type="button" onClick={addTab} disabled={workspace.tabs.length>=12||busy} aria-label="Ajouter un onglet"><Plus size={16}/></button>
        </div>
        <div className="pw-inspector-content" role="tabpanel" aria-label={tab?.title}>
          {tab&&<><div className="pw-document-heading"><PanelRight size={16}/><input aria-label="Titre de l’onglet" value={tab.title} onChange={e=>editTab({title:e.target.value})}/></div>
          {tab.kind==='profile'?<ProfileInspector profile={workspace.profile} onChange={(key,value)=>update(w=>({...w,profile:{...w.profile,[key]:value,confirmed:false}}))} onDiscuss={prompt=>submit(prompt)}/>:tab.kind==='tasks'?<><ResearchProgress title={tab.title} variant="plain" status={busy?'running':allTools.length?'complete':'queued'} phase={allTools.some(t=>t.status==='running')?'reading':'writing'} phaseLabels={{planning:'Demande',searching:'Contexte',reading:'Outils',writing:'Réponse'}} plan={allTools.map(t=>({id:t.id,title:t.name,status:t.status==='done'?'done':t.status==='running'?'active':'skipped'}))} sourcesRead={allSources.length} sourcesFound={allSources.length} current={busy?{kind:'write',text:activity}:undefined} summary={allTools.length?`${allTools.filter(t=>t.status==='done').length} opérations terminées`:'Aucune tâche lancée'} onCancel={busy?stop:undefined}/><textarea className="pw-document" aria-label="Notes du plan" value={tab.content} onChange={e=>editTab({content:e.target.value})}/>{tab.items?.map(item=><label className="pw-task" key={item.id}><input type="checkbox" checked={item.status==='done'} onChange={e=>editTab({items:tab.items?.map(x=>x.id===item.id?{...x,status:e.target.checked?'done':'pending'}:x)})}/><span>{item.title}</span></label>)}</>:tab.kind==='agents'?<div className="pw-agent-list">{allAgents.length?allAgents.map(a=><Subagent key={a.id} name={a.name} status={a.status} task={a.task} activity={a.status==='running'?'Analyse en cours':undefined} summary={a.summary} startedAt={a.startedAt} durationMs={a.durationMs} defaultOpen>{a.summary&&<ToolBrowser name="specialist_result" title="Aperçu du résultat" state={a.status==='failed'?'output-error':'output-available'} pageTitle={a.name} defaultOpen screenshotAlt="Contenu réel de la consultation Bedrock" screenshot={<div className="pw-result-preview"><strong>{a.name}</strong><p>{a.summary}</p></div>}/>}</Subagent> ):<p className="pw-muted">Aucun spécialiste appelé. Demandez un avis spécialisé dans la conversation.</p>}<h3>Outils et résultats</h3>{allTools.map(t=><details key={t.id} className="pw-tool"><summary>{t.name}<span>{t.status}</span></summary><h4>Entrée</h4><pre>{JSON.stringify(t.input,null,2)}</pre><h4>Résultat réel</h4><pre>{JSON.stringify(t.output??t.error,null,2)}</pre></details>)}<p className="pw-muted">Les aperçus montrent les résultats réels des consultations Bedrock.</p></div>:tab.kind==='sources'?<div className="pw-source-list">{allSources.length?allSources.map(s=><a href={safeSourceUrl(s.url)} target="_blank" rel="noreferrer" key={s.id}><ExternalLink size={14}/><div><strong>{s.title}</strong><p>{s.snippet}</p><small>{s.url}</small></div></a>):<p className="pw-muted">Les sources consultées apparaîtront ici.</p>}</div>:<><textarea className="pw-document" aria-label="Contenu de l’onglet" value={tab.content} onChange={e=>editTab({content:e.target.value})} placeholder="Écrivez ici ou demandez à l’assistant de remplir cet onglet…"/>{tab.items?.map(item=><label className="pw-task" key={item.id}><input type="checkbox" checked={item.status==='done'} onChange={e=>editTab({items:tab.items?.map(x=>x.id===item.id?{...x,status:e.target.checked?'done':'pending'}:x)})}/><span>{item.title}</span>{item.url&&<a href={safeSourceUrl(item.url)} target="_blank" rel="noreferrer">Source</a>}</label>)}</>}</>}
        </div>
        <footer className="pw-inspector-footer">{busy?'L’assistant met à jour votre espace…':'Modifiable par vous et par l’assistant'}<span>{workspace.tabs.length} onglets</span></footer>
      </section>
    </div>
  </section>;
}
