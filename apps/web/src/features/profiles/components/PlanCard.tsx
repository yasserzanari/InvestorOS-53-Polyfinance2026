import { ListChecks } from 'lucide-react';

export type ParsedPlan = { title: string; description?: string; steps: string[] };

/** Recognizes the concise French step plans currently returned by the profile assistant. */
export function parsePlan(text: string): ParsedPlan | null {
  const lines = text.split(/\r?\n/);
  const headingIndex = lines.findIndex(line => /^\s*plan en \d+ étapes?\s*:?\s*$/i.test(line.trim()));
  if (headingIndex < 0) return null;

  const title = lines[headingIndex].trim().replace(/\s*:?\s*$/, '');
  const steps: string[] = [];
  let description = '';
  for (const line of lines.slice(headingIndex + 1)) {
    const numbered = line.match(/^\s*\d+[.)]\s*(.+?)\s*$/);
    if (numbered) steps.push(numbered[1]);
    else if (steps.length && line.trim()) steps[steps.length - 1] += ` ${line.trim()}`;
    else if (!steps.length && line.trim()) description += `${description ? ' ' : ''}${line.trim()}`;
  }
  return steps.length ? { title, description: description || undefined, steps } : null;
}

export function PlanCard({ plan, waiting = false, responded = false }: {
  plan: ParsedPlan;
  waiting?: boolean;
  responded?: boolean;
}) {
  const status = responded ? 'Réponse envoyée' : waiting ? 'À confirmer' : `${plan.steps.length} étapes`;
  return <section className="pw-plan-card" aria-label={plan.title}>
    <header className="pw-plan-card-header">
      <ListChecks size={17} aria-hidden="true" />
      <h3>{plan.title}</h3>
      <span>{status}</span>
    </header>
    {plan.description && <p className="pw-plan-description">{plan.description}</p>}
    <ol aria-label="Étapes du plan">
      {plan.steps.map((step, index) => <li key={`${index}-${step}`}>
        <span className="pw-plan-step-icon" aria-hidden="true">{index + 1}</span>
        <span>{step}</span>
      </li>)}
    </ol>
    {waiting && <footer>Rien ne démarre avant votre confirmation.</footer>}
  </section>;
}
