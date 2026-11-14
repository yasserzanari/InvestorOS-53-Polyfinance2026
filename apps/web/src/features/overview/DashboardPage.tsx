import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { productModules } from '../../app/modules';
import { DashboardConversation } from './DashboardConversation';
import { DashboardOverview } from './DashboardOverview';
import { DashboardPrompt } from './DashboardPrompt';
import type { ChatMessage } from './dashboard-types';
import { getPromptSuggestions } from './prompt-suggestions';
import { useSpeechInput } from './useSpeechInput';
import { loadDemoOverview, type DemoApiConnection } from '../../shared/api';
import './dashboard.css';

export function DashboardPage() {
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState<'overview' | 'chat'>('overview');
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [api, setApi] = useState<DemoApiConnection>({ status: 'not_configured' });
  const { isListening, notice, toggle } = useSpeechInput();

  useEffect(() => {
    const controller = new AbortController();
    loadDemoOverview(controller.signal).then(setApi).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const sendPrompt = (initialQuestion?: string) => {
    const text = (initialQuestion ?? prompt).trim();
    if (!text) return;
    setMessages((current) => [...current, { id: Date.now(), role: 'user', text }]);
    setPrompt('');
    setView('chat');
  };

  const returnToOverview = () => {
    setView('overview');
    setMessages([]);
  };

  return (
    <div className={`dashboard-page${view === 'chat' ? ' is-chat-view' : ''}`}>
      <AnimatePresence mode="wait" initial={false}>
        {view === 'overview' ? (
          <motion.div
            key="overview"
            className="dashboard-overview-stage"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
          >
            <DashboardOverview api={api} onStartChat={(question) => sendPrompt(question)}>
              <DashboardPrompt
                value={prompt}
                onChange={setPrompt}
                onSend={() => sendPrompt()}
                isListening={isListening}
                onToggleMic={() => toggle(prompt, setPrompt)}
                notice={notice}
                suggestions={getPromptSuggestions(api, prompt)}
              />
            </DashboardOverview>
          </motion.div>
        ) : (
          <motion.div
            key="conversation"
            className="dashboard-conversation-stage"
            initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.992 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 10, scale: 0.992 }}
            transition={{ duration: reduceMotion ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <DashboardConversation
              messages={messages}
              value={prompt}
              onChange={setPrompt}
              onSend={() => sendPrompt()}
              onBack={returnToOverview}
              isListening={isListening}
              onToggleMic={() => toggle(prompt, setPrompt)}
              notice={notice}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ModuleLanding({ moduleId }: { moduleId: string }) {
  const module = productModules.find(({ id }) => id === moduleId);
  if (!module) return null;
  const Icon = module.icon;
  return (
    <section className="module-placeholder">
      <span className="module-placeholder-icon"><Icon size={21} /></span>
      <h1>{module.label}</h1>
      <p>{module.description}</p>
      <div className="module-placeholder-note">Cet espace est prêt à accueillir son flux de travail. Les données et actions apparaîtront ici lorsqu’elles seront reliées à une source réelle.</div>
      <Link className="text-action" to="/app">Retour à la vue d’ensemble <ArrowRight size={15} /></Link>
    </section>
  );
}
