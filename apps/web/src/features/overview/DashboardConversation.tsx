import { ArrowLeft, ArrowRight, CircleHelp, FileText, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardPrompt } from './DashboardPrompt';
import type { ChatMessage } from './dashboard-types';

type DashboardConversationProps = {
  messages: ChatMessage[];
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onBack: () => void;
  isListening: boolean;
  onToggleMic: () => void;
  notice: string;
};

const contextItems = [
  { label: 'Profil investisseur', value: 'À compléter', Icon: UserRound, href: '/app/profiles' },
  { label: 'Portefeuille', value: 'Non connecté', Icon: FileText, href: '/app/portfolios' },
  { label: 'Sources', value: 'Aucune reliée', Icon: ShieldCheck, href: '/app/evidence' },
];

export function DashboardConversation({ messages, value, onChange, onSend, onBack, isListening, onToggleMic, notice }: DashboardConversationProps) {
  return (
    <section className="dashboard-conversation" aria-label="Conversation InvestorOS">
      <div className="chat-main-panel">
        <header className="chat-panel-header">
          <div>
            <button type="button" className="chat-back-button" onClick={onBack}><ArrowLeft size={16} /> Retour au tableau de bord</button>
            <div className="chat-title-row"><span className="chat-agent-icon"><Sparkles size={18} /></span><h1>Votre question</h1></div>
          </div>
          <button type="button" className="chat-close-button" onClick={onBack} aria-label="Fermer la conversation">×</button>
        </header>

        <div className="chat-transcript" aria-live="polite">
          {messages.map((message) => (
            <div className="chat-user-message" key={message.id}><p>{message.text}</p></div>
          ))}
          <section className="chat-data-empty" aria-labelledby="chat-data-empty-title">
            <span className="chat-data-icon"><CircleHelp size={19} /></span>
            <div>
              <h2 id="chat-data-empty-title">L’analyse attend vos données</h2>
              <p>Reliez un profil, un portefeuille et des sources pour obtenir une réponse fondée sur des informations vérifiables.</p>
              <div className="chat-data-actions">
                <Link to="/app/profiles">Compléter le profil <ArrowRight size={13} /></Link>
                <Link to="/app/portfolios">Ajouter un portefeuille <ArrowRight size={13} /></Link>
              </div>
            </div>
          </section>
        </div>

        <DashboardPrompt
          value={value}
          onChange={onChange}
          onSend={onSend}
          isListening={isListening}
          onToggleMic={onToggleMic}
          notice={notice}
          compact
        />
      </div>

      <aside className="chat-context-panel" aria-labelledby="chat-context-title">
        <header className="context-header"><div><h2 id="chat-context-title">Contexte de l’analyse</h2><p>Éléments nécessaires pour répondre.</p></div></header>
        <div className="context-list">
          {contextItems.map(({ label, value: status, Icon, href }) => (
            <Link className="context-item" to={href} key={label}>
              <span className="context-item-icon"><Icon size={17} aria-hidden="true" /></span>
              <span><strong>{label}</strong><small>{status}</small></span>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          ))}
        </div>
        <div className="context-integrity-note"><ShieldCheck size={16} /><p>Les réponses apparaîtront après connexion des données et vérification des sources.</p></div>
      </aside>
    </section>
  );
}
