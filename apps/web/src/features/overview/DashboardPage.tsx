import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { productModules } from '../../app/modules';
import { useDemoAccount } from '../../shared/DemoAccountContext';
import { DashboardOverview } from './DashboardOverview';
import { DashboardPrompt } from './DashboardPrompt';
import { getPromptSuggestions } from './prompt-suggestions';
import { useSpeechInput } from './useSpeechInput';
import { loadDemoOverview, type DemoApiConnection } from '../../shared/api';
import './dashboard.css';

export function DashboardPage() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [prompt, setPrompt] = useState('');
  const [api, setApi] = useState<DemoApiConnection>({ status: 'not_configured' });
  const { activeAccount } = useDemoAccount();
  const { isListening, notice, toggle } = useSpeechInput();

  useEffect(() => {
    const controller = new AbortController();
    loadDemoOverview(activeAccount.id, controller.signal).then(setApi).catch(() => undefined);
    return () => controller.abort();
  }, [activeAccount.id]);

  const sendPrompt = (initialQuestion?: string) => {
    const text = (initialQuestion ?? prompt).trim();
    if (!text) return;
    navigate('/app/assistant', { state: { initialPrompt: text } });
  };

  return (
    <div className="dashboard-page">
      <motion.div
        className="dashboard-overview-stage"
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
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
