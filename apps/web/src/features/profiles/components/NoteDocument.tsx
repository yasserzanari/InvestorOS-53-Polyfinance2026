import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, Eye, FileText, Pencil } from 'lucide-react';
import { Markdown } from './ai-agent-response';
import './note-document.css';

export function NoteDocument({ title, content, onTitleChange, onContentChange, persistenceLabel }: {
  title: string;
  content: string;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  persistenceLabel: string;
}) {
  const [editing, setEditing] = useState(!content.trim());
  const [copied, setCopied] = useState(false);
  const userEdited = useRef(false);
  const previousContent = useRef(content);
  const body = useMemo(() => content.replace(/^\s*#\s+[^\n]+\n?/, '').trim().replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (link, label: string, url: string) => /^https?:\/\//i.test(url) ? link : label), [content]);
  const words = useMemo(() => content.trim().split(/\s+/).filter(Boolean).length, [content]);
  const links = useMemo(() => [...content.matchAll(/\[[^\]]+\]\(https?:\/\/[^\s)]+\)/g)].length, [content]);
  const minutes = Math.max(1, Math.ceil(words / 200));

  useEffect(() => {
    if (!previousContent.current.trim() && content.trim() && !userEdited.current) setEditing(false);
    previousContent.current = content;
  }, [content]);

  async function copyNote() {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      const input = document.createElement('textarea');
      input.value = content;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadNote() {
    const file = new Blob([`# ${title.trim() || 'Notes'}\n\n${content.replace(/^\s*#\s+[^\n]+\n?/, '').trim()}\n`], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(title || 'notes').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'notes'}.md`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="pw-note" aria-label={`Note : ${title}`}>
    <div className="pw-note-toolbar">
      <span className="pw-note-type"><FileText size={14}/>Note</span>
      <div className="pw-note-actions">
        <button type="button" onClick={() => void copyNote()} aria-live="polite">{copied ? <Check size={14}/> : <Copy size={14}/>}<span>{copied ? 'Copié' : 'Copier'}</span></button>
        <button type="button" onClick={downloadNote}><Download size={14}/><span>Télécharger</span></button>
        <div className="pw-note-mode" role="group" aria-label="Mode de la note">
          <button type="button" aria-pressed={!editing} onClick={() => setEditing(false)}><Eye size={14}/><span>Lire</span></button>
          <button type="button" aria-pressed={editing} onClick={() => setEditing(true)}><Pencil size={14}/><span>Modifier</span></button>
        </div>
      </div>
    </div>

    <article className="pw-note-paper">
      <header className="pw-note-header">
        {editing ? <input aria-label="Titre de la note" value={title} onChange={event => onTitleChange(event.currentTarget.value)} placeholder="Titre de la note"/> : <h1>{title || 'Notes sans titre'}</h1>}
        <div className="pw-note-meta"><span>{words.toLocaleString('fr-CA')} mots</span><i aria-hidden="true"/> <span>~ {minutes} min de lecture</span>{links > 0 && <><i aria-hidden="true"/><span>{links} liens</span></>}</div>
      </header>

      {editing ? <textarea className="pw-note-editor" aria-label="Contenu de la note en Markdown" value={content} onChange={event => { userEdited.current = true; onContentChange(event.currentTarget.value); }} placeholder={'## Résumé\n\nNotez ici les points importants…\n\n## Sources et éléments à vérifier\n\n- Ajoutez les liens et les questions ouvertes.'}/> : <div className="pw-note-prose">
        {body ? <Markdown text={body}/> : <p className="pw-note-empty">Cette note est vide. Passez en mode Modifier pour commencer.</p>}
      </div>}
    </article>
    <p className="pw-note-footnote">{persistenceLabel} · Les affirmations et sources doivent être vérifiées dans leur contexte.</p>
  </section>;
}
