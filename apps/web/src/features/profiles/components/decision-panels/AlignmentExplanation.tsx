import { Popover } from '@base-ui/react/popover';
import { ArrowUpRight, CircleHelp, MessageSquare, Pencil, TriangleAlert, X } from 'lucide-react';
import { fieldLabels, type FieldKey, type Profile } from '../../profile-model';
import { FINANCIAL_REFERENCES, type AlignmentIssue } from './alignment-review';

export function AlignmentExplanation({ issues, profile, onEdit, onDiscuss, disabled }: {
  issues: AlignmentIssue[]; profile: Profile; onEdit: (field: FieldKey) => void; onDiscuss: (prompt: string) => void; disabled: boolean;
}) {
  const conflict = issues.some(issue => issue.kind === 'conflict');
  const missing = issues.every(issue => issue.kind === 'missing');
  const title = conflict ? 'Incohérence à clarifier' : issues.some(issue => issue.kind === 'clarification') ? 'Point à clarifier' : 'Information à préciser';
  return <Popover.Root>
    <Popover.Trigger className={`di-issue-trigger${conflict ? ' is-conflict' : ''}${missing ? ' is-missing' : ''}`} openOnHover delay={120} closeDelay={200} aria-label={`${title} : ${issues.map(issue => issue.title).join('; ')}`}>
      {issues.some(issue => issue.kind !== 'missing') ? <TriangleAlert size={16}/> : <CircleHelp size={16}/>}<span className="visually-hidden">{title}</span>
    </Popover.Trigger>
    <Popover.Portal><Popover.Positioner side="bottom" align="end" sideOffset={8} collisionPadding={16} className="di-explanation-positioner"><Popover.Popup className={`di-explanation${conflict ? ' is-conflict' : ''}${missing ? ' is-missing' : ''}`} initialFocus={false}>
      <header><Popover.Title>{title}</Popover.Title><Popover.Close aria-label="Fermer l’explication"><X size={15}/></Popover.Close></header>
      {issues.map(issue => <section key={issue.id}>
        <h4>{issue.title}</h4><p>{issue.description}</p>
        <dl>{issue.fields.map(field => <div key={field}><dt>{fieldLabels[field]}</dt><dd>{profile[field] || 'Non renseigné'}</dd></div>)}</dl>
        <div className="di-explanation-actions">{issue.fields.map(field => <Popover.Close key={field} disabled={disabled} onClick={() => onEdit(field)}><Pencil size={12}/>{fieldLabels[field]}</Popover.Close>)}<Popover.Close disabled={disabled} onClick={() => onDiscuss(`Aide-moi à clarifier ce point : ${issue.title}. Voici mes déclarations : ${issue.fields.map(field => `${fieldLabels[field]} : « ${profile[field]} »`).join('; ')}. ${issue.question} Distingue les réponses connues, les inconnues et les éventuels capitaux séparés, sans supposer ma réponse.`)}><MessageSquare size={12}/>En parler</Popover.Close></div>
        {issue.sourceIds.length > 0 && <div className="di-rule-sources"><strong>Fondement financier</strong>{issue.sourceIds.map(id => {
          const source = FINANCIAL_REFERENCES[id];
          return source ? <div key={id}><p>{source.principle}</p><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ArrowUpRight size={12}/></a></div> : null;
        })}</div>}
      </section>)}
    </Popover.Popup></Popover.Positioner></Popover.Portal>
  </Popover.Root>;
}
