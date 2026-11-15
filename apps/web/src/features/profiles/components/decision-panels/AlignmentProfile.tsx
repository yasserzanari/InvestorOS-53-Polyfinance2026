import { useId, useState } from 'react';
import { Check, MessageSquare, Pencil, X } from 'lucide-react';
import { fieldLabels, fieldOrder, type FieldKey, type Profile } from '../../profile-model';
import { AlignmentExplanation } from './AlignmentExplanation';
import type { AlignmentIssue } from './alignment-review';

export function AlignmentProfile({ profile, fields, issues, onChange, onDiscuss, disabled, saveStatus }: {
  profile: Profile; fields: FieldKey[]; issues: AlignmentIssue[]; onChange: (field: FieldKey, value: string) => void;
  onDiscuss: (prompt: string) => void; disabled: boolean; saveStatus?: string;
}) {
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [draft, setDraft] = useState('');
  const [savedField, setSavedField] = useState<FieldKey | null>(null);
  const editorId = useId();
  const visible = [...new Set([...fields, ...issues.filter(issue => issue.kind === 'conflict').flatMap(issue => issue.fields)])];
  const remaining = fieldOrder.filter(field => !visible.includes(field));
  const edit = (field: FieldKey) => { setDraft(profile[field]); setEditing(field); setSavedField(null); };
  function save() {
    if (!editing || disabled || draft.length > 2000) return;
    onChange(editing, draft); setSavedField(editing); setEditing(null);
  }
  function rows(keys: FieldKey[]) {
    return <dl className="di-profile-rows">{keys.map(field => {
      const fieldIssues = issues.filter(issue => issue.fields.includes(field));
      const conflict = fieldIssues.some(issue => issue.kind === 'conflict');
      return <div className={`di-profile-row${conflict ? ' has-conflict' : ''}${fieldIssues.some(issue => issue.kind === 'clarification') ? ' has-question' : ''}${editing === field ? ' is-editing' : ''}`} key={field}>
        <dt>{fieldLabels[field]}</dt>
        <dd>{editing === field ? <form className="di-field-editor" onSubmit={event => { event.preventDefault(); save(); }}>
          <label htmlFor={`${editorId}-${field}`} className="visually-hidden">Modifier : {fieldLabels[field]}</label>
          <textarea id={`${editorId}-${field}`} aria-label={`Modifier : ${fieldLabels[field]}`} value={draft} onChange={event => setDraft(event.target.value)} maxLength={2000} rows={3} autoFocus disabled={disabled} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setEditing(null); } }}/>
          <div><button type="submit" disabled={disabled || draft === profile[field]}><Check size={12}/>Enregistrer</button><button type="button" onClick={() => setEditing(null)}><X size={12}/>Annuler</button><button type="button" disabled={disabled} onClick={() => { setEditing(null); onDiscuss(`Aide-moi à préciser mon profil sur « ${fieldLabels[field]} ». Ma réponse enregistrée est : « ${profile[field] || 'Non renseigné'} ». Pose une question ciblée avant de modifier ce champ.`); }}><MessageSquare size={12}/>En parler</button></div>
        </form> : <button className="di-field-value" type="button" onClick={() => edit(field)} disabled={disabled} aria-label={`Modifier ${fieldLabels[field]} : ${profile[field] || 'À préciser'}`}><span>{profile[field]?.trim() || 'À préciser'}</span><Pencil size={13}/></button>}</dd>
        {fieldIssues.length > 0 && <AlignmentExplanation issues={fieldIssues} profile={profile} onEdit={edit} onDiscuss={onDiscuss} disabled={disabled}/>}
      </div>;
    })}</dl>;
  }
  return <section className="di-context" aria-labelledby="di-context-heading">
    <div className="di-section-heading"><h3 id="di-context-heading">Vos réponses</h3><span>Profil actuel</span></div>
    {rows(visible)}
    {remaining.length > 0 && <details className="di-more-fields" open={editing !== null && remaining.includes(editing) ? true : undefined}><summary>Autres réponses <span>{remaining.length}</span></summary>{rows(remaining)}</details>}
    {issues.some(issue => issue.kind !== 'missing') && <section className="di-findings" aria-label="Points de cohérence">{issues.filter(issue => issue.kind !== 'missing').map(issue => <div key={issue.id} className={issue.kind === 'conflict' ? 'is-conflict' : ''}><span>{issue.title}</span><AlignmentExplanation issues={[issue]} profile={profile} onEdit={edit} onDiscuss={onDiscuss} disabled={disabled}/></div>)}</section>}
    {savedField && <p className="di-save-status" role="status">{fieldLabels[savedField]} modifié · {saveStatus || 'Mise à jour du profil'}</p>}
  </section>;
}
