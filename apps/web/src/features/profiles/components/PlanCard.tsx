import { ArrowRight, Check, ListChecks, LoaderCircle, Pencil } from 'lucide-react';
import type { AssistantPlan } from '../profile-api';

/** Recognizes the concise French step plans currently returned by the profile assistant. */
export function parsePlan(text: string): AssistantPlan | null {
  const lines = text.split(/\r?\n/);
  const headingIndex = lines.findIndex(line => /^\s*plan en \d+ étapes?\s*:?\s*$/i.test(line.trim()));
  if (headingIndex < 0) return null;

  const title = lines[headingIndex].trim().replace(/\s*:?\s*$/, '');
  const steps: AssistantPlan['steps'] = [];
  let description = '';
  for (const line of lines.slice(headingIndex + 1)) {
    const numbered = line.match(/^\s*\d+[.)]\s*(.+?)\s*$/);
    if (numbered) steps.push({ id: `step-${steps.length + 1}`, title: numbered[1] });
    else if (steps.length && line.trim()) steps[steps.length - 1].title += ` ${line.trim()}`;
    else if (!steps.length && line.trim()) description += `${description ? ' ' : ''}${line.trim()}`;
  }
  return steps.length ? { title, description: description || undefined, steps } : null;
}

export function PlanCard({ plan, waiting = false, responded = false, onApprove, onRevise, approveDisabled = false }: {
  plan: AssistantPlan;
  waiting?: boolean;
  responded?: boolean;
  onApprove?: () => void;
  onRevise?: () => void;
  approveDisabled?: boolean;
}) {
  const status = responded ? 'Réponse envoyée' : waiting ? 'À confirmer' : `${plan.steps.length} étapes`;
  return <section className="pw-plan-card" aria-label={plan.title} data-plan-state={waiting ? 'awaiting-approval' : responded ? 'responded' : 'drafting'}>
    <header className="pw-plan-card-header">
      <ListChecks size={17} aria-hidden="true" />
      <h3>{plan.title}</h3>
      <span>{status}</span>
    </header>
    {plan.description && <p className="pw-plan-description">{plan.description}</p>}
    <ol aria-label="Étapes du plan">
      {plan.steps.map((step, index) => <li key={step.id}>
        <span className="pw-plan-step-icon" aria-hidden="true">{index + 1}</span>
        <span>{step.title}{step.detail && <small>{step.detail}</small>}</span>
      </li>)}
    </ol>
    {waiting && <footer><span>Rien ne démarre avant votre confirmation.</span><div className="pw-plan-actions">{onRevise && <button type="button" className="pw-plan-revise" onClick={onRevise} disabled={approveDisabled}><Pencil size={13} />Modifier le plan</button>}{onApprove && <button type="button" className="pw-plan-launch" onClick={onApprove} disabled={approveDisabled} aria-label="Confirmer et lancer le plan de recherche">{approveDisabled ? <LoaderCircle size={14} className="pw-plan-approve-spinner" /> : <ArrowRight size={14} />}Lancer le plan</button>}</div></footer>}
    {responded && <footer className="pw-plan-card-confirmed"><Check size={14} aria-hidden="true" />Confirmation envoyée</footer>}
  </section>;
}
