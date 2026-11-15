import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Clock3, PanelRight, Plus, RotateCcw, Sparkles } from 'lucide-react';
import type { ConversationHistoryItem } from '../profiles/useProfileWorkspace';

function formatLastUsed(timestamp:number){return new Intl.DateTimeFormat('fr-CA',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Toronto'}).format(timestamp);}

/** Shared conversation surface used by the Assistant and profile workspaces. */
export function AssistantChatPanel({
  status,
  provider,
  model,
  onReset,
  resetDisabled = false,
  children,
  activity,
  composer,
  composerClassName = '',
  error,
  conversations = [],
  activeConversationId = '',
  onSelectConversation,
  assistantMode = false,
  landing = false,
  showStatus = true,
  workspaceToggle,
  workspaceOverview,
  workspaceOpen = false,
  onToggleWorkspace,
}: {
  status: string;
  provider: string;
  model?: string;
  onReset: () => void;
  resetDisabled?: boolean;
  children: ReactNode;
  activity?: ReactNode;
  composer: ReactNode;
  composerClassName?: string;
  error?: ReactNode;
  conversations?: ConversationHistoryItem[];
  activeConversationId?: string;
  onSelectConversation?: (id:string) => void;
  assistantMode?: boolean;
  landing?: boolean;
  showStatus?: boolean;
  workspaceToggle?: ReactNode;
  workspaceOverview?: ReactNode;
  workspaceOpen?: boolean;
  onToggleWorkspace?: () => void;
}) {
  const [historyOpen,setHistoryOpen]=useState(false);
  const historyRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!historyOpen)return;
    const onPointerDown=(event:PointerEvent)=>{if(!historyRef.current?.contains(event.target as Node))setHistoryOpen(false);};
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')setHistoryOpen(false);};
    document.addEventListener('pointerdown',onPointerDown);document.addEventListener('keydown',onKeyDown);
    return()=>{document.removeEventListener('pointerdown',onPointerDown);document.removeEventListener('keydown',onKeyDown);};
  },[historyOpen]);
  const [topbarTarget,setTopbarTarget]=useState<HTMLElement|null>(null);
  useEffect(()=>{setTopbarTarget(document.getElementById('assistant-topbar-actions'));},[]);
  const historyControl=<div className="pw-history-control" ref={historyRef}>
          <button type="button" className="pw-history-trigger" onClick={()=>setHistoryOpen(open=>!open)} aria-expanded={historyOpen} aria-controls="pw-conversation-history">
            <Clock3 size={15}/><span>Historique</span><ChevronDown size={13}/>
          </button>
          {historyOpen&&<section className="pw-history-popover" id="pw-conversation-history" aria-label="Historique des conversations">
            <header><div><strong>Conversations</strong><span>{conversations.length} enregistrée{conversations.length===1?'':'s'}</span></div><button type="button" className="pw-history-new" onClick={()=>{onReset();setHistoryOpen(false);}} disabled={resetDisabled}><Plus size={14}/>Nouvelle</button></header>
            {conversations.length?<ul>{conversations.map(item=><li key={item.id}><button type="button" className={item.id===activeConversationId?'is-current':''} onClick={()=>{onSelectConversation?.(item.id);setHistoryOpen(false);}}><span className="pw-history-title">{item.title}</span><time dateTime={new Date(item.lastUsedAt).toISOString()}>{formatLastUsed(item.lastUsedAt)}</time></button></li>)}</ul>:<p className="pw-history-empty">Vos conversations apparaîtront ici après votre premier message.</p>}
          </section>}
        </div>;
  return (
    <section className={`pw-chat${landing?' is-landing':''}`} aria-label="Conversation avec l’assistant">
      {!assistantMode&&<header className="pw-chat-header">
        <div className="pw-assistant-icon"><Sparkles size={18} /></div>
        <div><strong>Assistant InvestorOS</strong>{showStatus&&<p>{status}</p>}</div>
        <span title={model} className="pw-provider">{provider}</span>
        {workspaceToggle}
        <button type="button" className="pw-new-chat" onClick={onReset} disabled={resetDisabled} aria-label={assistantMode?'Nouvelle conversation':'Réinitialiser le profil'} title={assistantMode?'Démarrer une nouvelle conversation':'Réinitialiser le profil et la conversation'}>{assistantMode?<Plus size={15}/>:<RotateCcw size={15}/>}</button>
      </header>}
      {assistantMode&&topbarTarget&&createPortal(<>{historyControl}</>,topbarTarget)}
      {assistantMode&&<div className="pw-floating-actions"><button type="button" className={`pw-chat-workspace-toggle${workspaceOpen?' is-open':''}`} aria-controls="assistant-workspace-panel" aria-expanded={workspaceOpen} aria-label={workspaceOpen?'Fermer les onglets':'Ouvrir les onglets'} title={workspaceOpen?'Fermer les onglets':'Ouvrir les onglets'} onClick={onToggleWorkspace}><PanelRight size={16}/></button>{workspaceOverview}<button type="button" className="pw-new-chat pw-floating-new" onClick={onReset} disabled={resetDisabled} aria-label="Nouvelle conversation" title="Nouvelle conversation"><Plus size={18}/></button></div>}
      {children}
      {activity && <div className="pw-current-activity">{activity}</div>}
      {!landing&&<div className={`pw-composer ${composerClassName}`}>
        {composer}
        <span>Conversation et espace de travail enregistrés dans ce navigateur. Les messages sont envoyés à Amazon Bedrock.</span>
        {error && <p className="pw-error" role="alert">{error}</p>}
      </div>}
    </section>
  );
}
