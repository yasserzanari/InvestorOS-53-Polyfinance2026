import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, MessageSquareText, X } from 'lucide-react';
import './ask-user-card.css';

import type { AskUserRequest, AskUserQuestion, AskUserAnswer } from '../question-model';
export type { AskUserRequest, AskUserQuestion, AskUserAnswer } from '../question-model';
export type AskUserOption = AskUserQuestion['options'][number];
type DraftValue = { selected: string[]; text: string; other: boolean };
type Draft = Record<string, DraftValue>;
export type AskUserCardProps = {
  request: AskUserRequest;
  answer?: AskUserAnswer;
  disabled?: boolean;
  onSubmit: (answer: AskUserAnswer) => void;
  onDismiss?: () => void;
};

function restoreDraft(request: AskUserRequest): Draft {
  let saved: Draft = {};
  try { saved = JSON.parse(localStorage.getItem(`investoros.ask-user.${request.id}`) || '{}'); } catch { /* Start blank when storage is unavailable. */ }
  return Object.fromEntries(request.questions.map(question => {
    const value = saved?.[question.id];
    return [question.id, {
      selected: Array.isArray(value?.selected) ? value.selected.filter(id => typeof id === 'string' && question.options.some(option => option.id === id)).slice(0, question.kind === 'single_choice' ? 1 : 6) : [],
      text: typeof value?.text === 'string' ? value.text.slice(0, 4000) : '',
      other: question.allowOther && value?.other === true,
    }];
  }));
}
function validate(question: AskUserQuestion, value: DraftValue): string {
  if (question.kind === 'text') return question.required && !value.text.trim() ? 'Écrivez une réponse avant de continuer.' : '';
  if (value.other && !value.text.trim()) return 'Précisez votre réponse dans le champ « Autre réponse ».';
  if (question.required && !value.selected.length && !(question.allowOther && value.other && value.text.trim())) return question.kind === 'multiple_choice' ? 'Choisissez au moins une réponse.' : 'Choisissez une réponse.';
  return '';
}

/** A keyed inner view keeps independent drafts when the assistant publishes a new request. */
export function AskUserCard(props: AskUserCardProps) {
  return <AskUserCardView key={props.request.id} {...props} />;
}
function AskUserCardView({ request, answer, disabled = false, onSubmit, onDismiss }: AskUserCardProps) {
  const [draft, setDraft] = useState<Draft>(() => restoreDraft(request));
  const [active, setActive] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const uid = useId();
  const form = useRef<HTMLFormElement>(null);
  const focusTarget = useRef<string | null>(null);
  const question = request.questions[active];
  const submitted = answer?.requestId === request.id;
  useEffect(() => {
    try {
      if (submitted) localStorage.removeItem(`investoros.ask-user.${request.id}`);
      else localStorage.setItem(`investoros.ask-user.${request.id}`, JSON.stringify(draft));
    } catch { /* The open card still keeps its draft in memory. */ }
  }, [draft, request.id, submitted]);
  useEffect(() => {
    if (!focusTarget.current || !form.current) return;
    form.current.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    focusTarget.current = null;
  }, [active, errors]);
  if (!question) return null;
  const value = draft[question.id];
  const update = (patch: Partial<DraftValue>) => {
    setDraft(current => ({ ...current, [question.id]: { ...current[question.id], ...patch } }));
    setErrors(current => ({ ...current, [question.id]: '' }));
  };
  const select = (id: string) => {
    if (question.kind === 'single_choice') update({ selected: [id], other: false });
    else update({ selected: value.selected.includes(id) ? value.selected.filter(item => item !== id) : [...value.selected, id] });
  };
  const next = () => setActive(index => Math.min(index + 1, request.questions.length - 1));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || submitted) return;
    const failures = Object.fromEntries(request.questions.map(item => [item.id, validate(item, draft[item.id])]));
    const invalidIndex = request.questions.findIndex(item => failures[item.id]);
    if (invalidIndex >= 0) {
      focusTarget.current = request.questions[invalidIndex].id;
      setErrors(failures); setActive(invalidIndex); return;
    }
    onSubmit({ requestId: request.id, answers: request.questions.map(item => ({
      questionId: item.id,
      selectedOptionIds: item.kind === 'text' ? [] : draft[item.id].selected,
      text: item.kind === 'text' || draft[item.id].other ? draft[item.id].text.trim() : '',
    })) });
  };
  const errorId = `${uid}-error`;
  const titleId = `${uid}-title`;
  return <section className={`ask-user-card${submitted ? ' is-submitted' : ''}`} aria-labelledby={titleId}>
    <header className="ask-user-header">
      <div className="ask-user-title"><MessageSquareText size={16} aria-hidden="true" /><h3 id={titleId}>{request.title}</h3></div>
      {submitted ? <span className="ask-user-sent"><Check size={13} />Réponses envoyées</span> : <button type="button" className="ask-user-close" aria-label={collapsed ? 'Afficher les questions' : 'Réduire les questions'} aria-expanded={!collapsed} onClick={() => { setCollapsed(current => !current); if (!collapsed) onDismiss?.(); }}>{collapsed ? <ChevronDown size={16} /> : <X size={16} />}</button>}
    </header>
    {submitted ? <dl className="ask-user-summary">{request.questions.map(item => {
      const itemAnswer = answer?.answers.find(entry => entry.questionId === item.id);
      const selected = item.options.filter(option => itemAnswer?.selectedOptionIds.includes(option.id)).map(option => option.label);
      const parts = [...selected, itemAnswer?.text].filter(Boolean);
      return <div key={item.id}><dt>{item.label}</dt><dd>{parts.length ? parts.join(' · ') : 'Non renseigné'}</dd></div>;
    })}</dl> : collapsed ? <button type="button" className="ask-user-reopen" onClick={() => setCollapsed(false)}>Reprendre les questions <ChevronDown size={14} /></button> : <form onSubmit={submit} ref={form}>
      {request.description && <p className="ask-user-description">{request.description}</p>}
      <fieldset className="ask-user-question" disabled={disabled} aria-describedby={errors[question.id] ? errorId : undefined}>
        <legend>{question.label}{!question.required && <span>Facultatif</span>}</legend>
        {question.description && <p className="ask-user-question-description">{question.description}</p>}
        {question.kind === 'multiple_choice' && <p className="ask-user-instruction">Vous pouvez choisir plusieurs réponses.</p>}
        {question.kind === 'text' ? <textarea className="ask-user-text" value={value.text} onChange={event => update({ text: event.target.value })} placeholder={question.placeholder || 'Développez votre réponse…'} maxLength={4000} rows={4} aria-label={question.label} aria-invalid={Boolean(errors[question.id])} aria-describedby={errors[question.id] ? errorId : undefined} /> : <div className="ask-user-options">{question.options.map(option => <label className={`ask-user-option${value.selected.includes(option.id) ? ' is-selected' : ''}`} key={option.id}>
          <input type={question.kind === 'single_choice' ? 'radio' : 'checkbox'} name={`${uid}-${question.id}`} value={option.id} checked={value.selected.includes(option.id)} onChange={() => select(option.id)} aria-invalid={Boolean(errors[question.id])} aria-describedby={errors[question.id] ? errorId : undefined} />
          <span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
        </label>)}{question.allowOther && <><label className={`ask-user-option${value.other ? ' is-selected' : ''}`}><input type={question.kind === 'single_choice' ? 'radio' : 'checkbox'} name={`${uid}-${question.id}`} checked={value.other} onChange={() => update({ other: !value.other, ...(question.kind === 'single_choice' ? { selected: [] } : {}) })} /><span><strong>Autre réponse</strong><small>Précisez avec vos propres mots.</small></span></label>{value.other && <textarea className="ask-user-text ask-user-other" value={value.text} onChange={event => update({ text: event.target.value })} placeholder={question.placeholder || 'Précisez votre réponse…'} maxLength={4000} rows={3} aria-label="Autre réponse" aria-invalid={Boolean(errors[question.id])} aria-describedby={errors[question.id] ? errorId : undefined} />}</>}</div>}
        {errors[question.id] && <p id={errorId} className="ask-user-error" role="alert">{errors[question.id]}</p>}
      </fieldset>
      <footer className="ask-user-footer">
        {request.questions.length === 1 && <span className="ask-user-counter">Votre réponse reste modifiable avant l’envoi.</span>}
        <Pagination>
          <PaginationContent>
            {request.questions.length > 1 && <PaginationItem><button type="button" className="ask-user-previous" disabled={active === 0 || disabled} onClick={() => setActive(index => index - 1)} aria-label="Question précédente"><ChevronLeft size={14} /><span>Précédent</span></button></PaginationItem>}
            {request.questions.length > 1 && request.questions.map((item, index) => <PaginationItem key={item.id}><button type="button" className="ask-user-page" aria-current={index === active ? 'step' : undefined} aria-label={`Question ${index + 1} : ${item.label}`} onClick={() => setActive(index)} disabled={disabled}>{String(index + 1).padStart(2, '0')}</button></PaginationItem>)}
            <PaginationItem>{active < request.questions.length - 1 ? <button type="button" className="ask-user-submit" onClick={next} disabled={disabled}>Continuer<ChevronRight size={14} /></button> : <button type="submit" className="ask-user-submit" disabled={disabled}>Envoyer<Check size={14} /></button>}</PaginationItem>
          </PaginationContent>
        </Pagination>
      </footer>
    </form>}
  </section>;
}

// Native-button boundary for the supplied numbered pagination composition.
function Pagination({ children }: { children: ReactNode }) {
  return <nav className="ask-user-pagination" aria-label="Navigation des questions">{children}</nav>;
}
function PaginationContent({ children }: { children: ReactNode }) {
  return <ol className="ask-user-pagination-content">{children}</ol>;
}
function PaginationItem({ children }: { children: ReactNode }) {
  return <li>{children}</li>;
}
