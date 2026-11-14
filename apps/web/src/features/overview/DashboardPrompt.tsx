import { Mic, MicOff } from 'lucide-react';
import { AdvancedChatInput } from '../../shared/ui/advanced-ai-chat-input';

type DashboardPromptProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isListening: boolean;
  onToggleMic: () => void;
  notice: string;
  compact?: boolean;
};

export function DashboardPrompt({ value, onChange, onSend, isListening, onToggleMic, notice, compact = false }: DashboardPromptProps) {
  return (
    <div className={`dashboard-prompt-wrap${compact ? ' is-compact' : ''}`}>
      <AdvancedChatInput
        className="dashboard-prompt"
        textareaProps={{
          value,
          onChange: (event) => onChange(event.currentTarget.value),
          onKeyDown: (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          },
          placeholder: compact ? 'Écrire une question…' : 'Ex. Quels éléments dois-je vérifier dans mon portefeuille?',
          'aria-label': 'Votre question pour InvestorOS',
          className: 'dashboard-prompt-textarea',
        }}
        sendButtonProps={{
          type: 'button',
          'aria-label': 'Envoyer la question',
          className: 'dashboard-prompt-send',
        }}
        onSend={onSend}
        actionIcons={[
          <button
            key="microphone"
            type="button"
            className={`dashboard-microphone${isListening ? ' is-listening' : ''}`}
            aria-label={isListening ? 'Arrêter la dictée' : 'Dicter une question'}
            aria-pressed={isListening}
            onClick={onToggleMic}
            title={isListening ? 'Arrêter la dictée' : 'Dicter une question'}
          >
            {isListening ? <MicOff size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
          </button>,
        ]}
      />
      <p className="dashboard-prompt-note" aria-live="polite">{notice || 'Vos données de portefeuille ne sont pas encore connectées.'}</p>
    </div>
  );
}
