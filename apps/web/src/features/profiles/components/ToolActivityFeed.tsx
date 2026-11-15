import { Check, CircleAlert, Circle, LoaderCircle, ChevronRight } from 'lucide-react';
import type { ToolEvent } from '../profile-api';
import { terminalResearch, type ResearchRun } from '../research-workspace';
import './tool-activity.css';

const RESEARCH_TOOLS = new Set([
  'start_analysis', 'get_analysis_status', 'get_analysis_result', 'get_evidence',
  'inspect_market_movements', 'inspect_supply_chain', 'read_authorized_x_posts',
  'list_authorized_x_profiles', 'load_skill', 'search_skills', 'publish_plan',
]);
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};

type StepState = 'done' | 'active' | 'pending' | 'failed';
function Step({ title, detail, state, last = false }: { title: string; detail: string; state: StepState; last?: boolean }) {
  const Icon = state === 'done' ? Check : state === 'active' ? LoaderCircle : state === 'failed' ? CircleAlert : Circle;
  return <li className={`research-progress-step is-${state}${last ? ' is-last' : ''}`}>
    <span className="research-progress-marker"><Icon size={state === 'pending' ? 15 : 16} /></span>
    <span className="research-progress-copy"><strong>{title}</strong><small>{detail}</small></span>
  </li>;
}

export function ToolActivityFeed({ tools, runs = [], active, onOpenResearch }: { tools: ToolEvent[]; runs?: ResearchRun[]; active: boolean; onOpenResearch: () => void }) {
  const toolsInScope = tools.filter(tool => RESEARCH_TOOLS.has(tool.name));
  if (!toolsInScope.length) return null;

  const start = [...toolsInScope].reverse().find(tool => tool.name === 'start_analysis');
  const result = record(start?.output);
  const run = typeof result.analysis_id === 'string' ? runs.find(item => item.analysis_id === result.analysis_id) : undefined;
  const hasRun = Boolean(run || typeof result.analysis_id === 'string');
  const failed = start?.status === 'failed';
  const interrupted = start?.status === 'running' && !active;
  const activity = toolsInScope.some(tool => tool.status === 'running') && active;
  const exhausted = failed && /limite quotidienne/i.test(start?.error ?? '');
  const preparationDone = Boolean(start) || toolsInScope.some(tool => tool.status === 'done');
  const completed = Boolean(run && terminalResearch(run.status) && !['failed', 'error', 'cancelled', 'canceled'].includes(run.status.toLowerCase()));
  const runFailed = Boolean(run && ['failed', 'error', 'cancelled', 'canceled'].includes(run.status.toLowerCase()));

  const launchState: StepState = failed || interrupted ? 'failed' : hasRun ? 'done' : activity && start ? 'active' : 'pending';
  const resultsState: StepState = completed ? 'done' : runFailed ? 'failed' : run || (start?.status === 'done' && !run) ? 'active' : 'pending';
  const launchDetail = exhausted
    ? 'La limite quotidienne est atteinte. Aucune analyse n’a été lancée.'
    : failed
      ? 'Le service n’a pas accepté la demande. Aucun lancement n’a été confirmé.'
      : interrupted
        ? 'Le lancement a été interrompu avant confirmation.'
        : hasRun
          ? 'La demande a été acceptée.'
          : start?.status === 'running'
            ? 'Envoi de votre demande au moteur de recherche…'
            : 'La demande sera envoyée après préparation.';
  const resultsDetail = completed ? 'Les résultats sont prêts à consulter.' : runFailed ? 'Cette analyse s’est arrêtée sans résultat complet.' : run ? 'Les sources et les résultats sont en cours de préparation.' : hasRun ? 'Préparation des premières étapes de recherche…' : 'En attente du lancement.';

  return <section className="research-progress" aria-label="Avancement de l’analyse" aria-live="polite">
    <ol>
      <Step title="Je prépare l’analyse" detail={preparationDone ? 'La méthode et les informations utiles sont prêtes.' : 'Je rassemble le contexte de votre demande…'} state={preparationDone ? 'done' : activity ? 'active' : 'pending'} />
      <Step title="Je lance l’analyse" detail={launchDetail} state={launchState} />
      <Step title="Je vérifie les résultats" detail={resultsDetail} state={resultsState} last />
    </ol>
    {(hasRun || run) && <button type="button" onClick={onOpenResearch}>{completed ? 'Voir les résultats' : 'Voir l’avancement'}<ChevronRight size={14} /></button>}
  </section>;
}

export function toolActivityLabel(name: string) {
  if (name === 'start_analysis') return 'Je lance l’analyse';
  if (['get_analysis_status', 'get_analysis_result', 'get_evidence'].includes(name)) return 'Je vérifie les résultats';
  return 'Je prépare l’analyse';
}
