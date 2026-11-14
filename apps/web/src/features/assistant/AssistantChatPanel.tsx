import type { ReactNode } from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';

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
}) {
  return (
    <section className="pw-chat" aria-label="Conversation avec l’assistant">
      <header className="pw-chat-header">
        <div className="pw-assistant-icon"><Sparkles size={18} /></div>
        <div><strong>Assistant InvestorOS</strong><p>{status}</p></div>
        <span title={model} className="pw-provider">{provider}</span>
        <button type="button" className="pw-new-chat" onClick={onReset} disabled={resetDisabled} aria-label="Nouvelle conversation" title="Réinitialiser le profil et la conversation"><RotateCcw size={15} /></button>
      </header>
      {children}
      {activity && <div className="pw-current-activity">{activity}</div>}
      <div className={`pw-composer ${composerClassName}`}>
        {composer}
        <span>Conversation et espace de travail enregistrés dans ce navigateur. Les messages sont envoyés à Amazon Bedrock.</span>
        {error && <p className="pw-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
