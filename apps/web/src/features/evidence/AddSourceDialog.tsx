import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Globe2, Plus, X } from 'lucide-react';
import { loadSourceLearning, sourceLearningBase, startSourceLearning, type SourceLearning } from '../../shared/api';

export function AddSourceDialog({ account, job, onJob, onComplete, onClose }: {account:string; job:string | null; onJob:(id:string)=>void; onComplete:(site:string)=>void; onClose:()=>void}) {
  const [url,setUrl]=useState('');
  const [state,setState]=useState<SourceLearning>();
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  const completed=useRef('');
  useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close();},[]);
  useEffect(()=>{
    if(!job)return;
    const c=new AbortController();let timer:number;
    async function poll(){try{const result=await loadSourceLearning(account,job!,c.signal);setState(result);setError('');if(result.status==='complete'&&result.site&&completed.current!==job){completed.current=job!;onComplete(result.site);}if(result.status==='running')timer=window.setTimeout(poll,1200);}catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:'Connexion interrompue.');}}
    void poll();return()=>{c.abort();window.clearTimeout(timer);};
  },[account,job]);
  async function start(){setBusy(true);setError('');try{const result=await startSourceLearning(account,url);onJob(result.id);}catch(e){setError(e instanceof Error?e.message:'Apprentissage indisponible.');}finally{setBusy(false);}}
  return createPortal(<dialog className={`add-source-dialog${job?' is-learning':''}`} ref={dialog} onCancel={onClose} aria-labelledby="add-source-title">
    <header><div><span>NOUVELLE SOURCE</span><h2 id="add-source-title">{job?'Apprentissage de l’API':'Ajouter une source'}</h2></div><button type="button" onClick={onClose} aria-label="Fermer"><X size={19}/></button></header>
    {!job?<form onSubmit={e=>{e.preventDefault();void start();}} className="add-source-form"><span className="add-source-icon"><Globe2 size={24}/></span><h3>Quelle page souhaitez-vous connecter ?</h3><p>Indiquez une page publique. API Anything analyse ses requêtes pour apprendre une opération de lecture et la vérifier sur d’autres pages du même site.</p><label htmlFor="new-source-url">Lien de la source<input id="new-source-url" type="url" required placeholder="https://…" value={url} onChange={e=>setUrl(e.target.value)}/></label><small>Les opérations apprises restent sur ce serveur. Les sites nécessitant une connexion peuvent refuser la lecture.</small>{error&&<p role="alert">{error}</p>}<button type="submit" disabled={busy}>{busy?'Démarrage…':'Suivant'}<Plus size={15}/></button></form>:<div className="source-learning-layout"><section className="source-learning-agent"><header><Bot size={21}/><div><strong>Agent API Anything</strong><small>{state?.status==='complete'?'Vérification terminée':state?.status==='error'?'Intervention nécessaire':'Analyse du site'}</small></div><span className={`learning-status is-${state?.status??'running'}`}/></header><ol aria-live="polite">{state?.events.map((event,i)=><li key={i}><span>{String(i+1).padStart(2,'0')}</span><p>{event.message}</p></li>)}</ol>{state?.result?.signature&&<code>{state.result.signature}</code>}{error&&<p role="alert">{error}</p>}{state?.status==='complete'&&<button type="button" onClick={onClose}>Voir les API disponibles</button>}{state?.status==='error'&&<button type="button" onClick={()=>{onJob('');setState(undefined);}}>Essayer une autre page</button>}</section><section className="source-learning-browser"><header><Globe2 size={15}/><span>{state?.url||url||'Navigateur de lecture'}</span><small>Capture réelle</small></header>{state?.frame ? <img key={job} src={`${sourceLearningBase()}/${account}/${job}/frame/${state.frame}`} alt="Page inspectée par le navigateur API Anything"/>:<div className="source-browser-empty"><Globe2 size={32}/><p>{state?.status==='error'?'Aucune capture disponible.':'Ouverture du navigateur…'}</p></div>}</section></div>}
  </dialog>,document.body);
}
