import { useEffect, useRef, useState } from 'react';
import { BookOpen, ExternalLink, FileText, X } from 'lucide-react';
import { preciseDate, sourceUrl } from './presentation';
import './source-details.css';

export type SourceDescription = {
  id: string; title: string; publisher?: string; url?: string;
  collectedAt?: string; dateLabel?: string; excerpt?: string; limits?: string;
  documents?: { title: string; url?: string; date?: string; excerpt?: string }[];
};
export function SourceDetailsButton({ sources, label = 'Sources' }: { sources: SourceDescription[]; label?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open,setOpen]=useState(false);
  useEffect(()=>{if(open)dialog.current?.showModal();},[open]);
  return <>
    <button type="button" className="source-details-trigger" onClick={() => setOpen(true)} aria-label={`${label} · ${sources.length}`}>
      <BookOpen size={14} /><span>{label}</span><span className="source-details-count">{sources.length}</span>
    </button>
    <dialog ref={dialog} className="source-details-dialog" aria-label={label} onClose={()=>setOpen(false)}>
      {open&&<>
      <header><div><h3>{label}</h3><p>{sources.length} référence{sources.length > 1 ? 's' : ''} · documents et dates disponibles</p></div><button type="button" aria-label="Fermer les sources" onClick={() => dialog.current?.close()}><X size={19} /></button></header>
      <div className="source-details-list">{sources.length ? sources.map(source => <article key={source.id}>
        <div className="source-details-title"><FileText size={18} /><div><h4>{source.title}</h4>{source.publisher && <p>{source.publisher}</p>}</div>{sourceUrl(source.url) && <a href={sourceUrl(source.url)} target="_blank" rel="noreferrer" aria-label={`Ouvrir ${source.title}`}><ExternalLink size={15} /></a>}</div>
        {(source.dateLabel || source.collectedAt) && <dl className="source-details-dates">{source.dateLabel && <div><dt>Période</dt><dd>{source.dateLabel}</dd></div>}{source.collectedAt && <div><dt>Consultée</dt><dd>{preciseDate(source.collectedAt)}</dd></div>}</dl>}
        {source.excerpt && <p className="source-details-excerpt">{source.excerpt}</p>}
        {source.documents?.map((document, index) => <details key={`${document.url}-${index}`}><summary>{document.title}{document.date && <time>{preciseDate(document.date)}</time>}</summary>{sourceUrl(document.url) && <a href={sourceUrl(document.url)} target="_blank" rel="noreferrer">Lire le document <ExternalLink size={13} /></a>}{document.excerpt && <p className="source-details-excerpt">{document.excerpt}</p>}</details>)}
        {source.limits && <details><summary>Portée et limites de cette source</summary><p>{source.limits}</p></details>}
      </article>) : <p>Aucune référence disponible pour cette section.</p>}</div>
      </>}
    </dialog>
  </>;
}
