import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ChevronUp, Lightbulb, Mic, MicOff } from 'lucide-react';
import { AdvancedChatInput } from '../../shared/ui/advanced-ai-chat-input';

type DashboardPromptProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isListening: boolean;
  onToggleMic: () => void;
  notice: string;
  compact?: boolean;
  suggestions?: string[];
};

export function DashboardPrompt({ value, onChange, onSend, isListening, onToggleMic, notice, compact = false, suggestions = [] }: DashboardPromptProps) {
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const suggestionsToggle = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  const closeSuggestions = () => {
    setSuggestionsOpen(false);
    suggestionsToggle.current?.focus();
  };

  useEffect(() => {
    if (!suggestionsOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSuggestions();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [suggestionsOpen]);

  const selectSuggestion = (suggestion: string) => {
    onChange(suggestion);
    setSuggestionsOpen(false);
    requestAnimationFrame(() => wrapper.current?.querySelector('textarea')?.focus());
  };

  return (
    <div ref={wrapper} className={`dashboard-prompt-wrap${compact ? ' is-compact' : ''}`}>
      <AnimatePresence initial={false}>
        {suggestionsOpen && suggestions.length > 0 && (
          <motion.section
            key="prompt-suggestions"
            id="dashboard-prompt-suggestions"
            aria-label="Suggestions de questions"
            className="dashboard-prompt-suggestions"
            initial={reduceMotion ? false : { opacity: 0, y: 10, scale: .985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 7, scale: .99 }}
            transition={{ duration: reduceMotion ? 0 : .18, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="dashboard-suggestions-heading">
              <span><Lightbulb size={15} aria-hidden="true" /> Suggestions pour votre espace</span>
              <button type="button" aria-label="Fermer les suggestions" onClick={closeSuggestions}>Échap</button>
            </div>
            <div className="dashboard-suggestion-list" aria-live="polite">
              {suggestions.map((suggestion, index) => (
                <motion.button
                  key={suggestion}
                  type="button"
                  className="dashboard-suggestion-option"
                  onClick={() => selectSuggestion(suggestion)}
                  initial={reduceMotion ? false : { opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduceMotion ? 0 : .14, delay: reduceMotion ? 0 : index * .035 }}
                >
                  <span>{suggestion}</span><ArrowRight size={14} aria-hidden="true" />
                </motion.button>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
      <AdvancedChatInput
        className="dashboard-prompt"
        hideSendButton={!compact}
        textareaProps={{
          value,
          onChange: (event) => onChange(event.currentTarget.value),
          onKeyDown: (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          },
          placeholder: compact ? 'Écrire une question…' : 'Que souhaitez-vous examiner dans votre espace ?',
          'aria-label': 'Votre question pour InvestorOS',
          className: 'dashboard-prompt-textarea',
        }}
        onSend={onSend}
        actionIcons={[
          ...(suggestions.length > 0 && !compact ? [
            <button
              ref={suggestionsToggle}
              key="suggestions"
              type="button"
              className={`dashboard-suggestions-toggle${suggestionsOpen ? ' is-open' : ''}`}
              aria-expanded={suggestionsOpen}
              aria-controls="dashboard-prompt-suggestions"
              onClick={() => setSuggestionsOpen((open) => !open)}
            >
              <Lightbulb size={15} aria-hidden="true" /><span>Suggestions</span><ChevronUp size={13} aria-hidden="true" />
            </button>,
          ] : []),
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
          <span key="enter-hint" className="dashboard-prompt-enter-hint">Entrée pour envoyer</span>,
        ]}
      />
      {notice && <p className="dashboard-prompt-note" role="status" aria-live="polite">{notice}</p>}
    </div>
  );
}
