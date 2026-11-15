import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { loadPublicXProfile, type PublicXProfile } from '../../shared/api';
import { XProfileDetails } from './XProfileDetails';

export function AddProfileDialog({query,onQuery,onSearch,onAdd,onClose,authorized}:{query:string;onQuery:(query:string)=>void;onSearch:(query:string,error?:string)=>void;onAdd:(profile:PublicXProfile)=>void;onClose:()=>void;authorized:PublicXProfile[]}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const request=useRef<AbortController | null>(null);
  const [candidate,setCandidate]=useState<PublicXProfile>();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{dialog.current?.showModal();return()=>{request.current?.abort();dialog.current?.close();};},[]);
  async function search(username=query){
    request.current?.abort();const controller=new AbortController();request.current=controller;
    setBusy(true);setError('');setCandidate(undefined);
    try{const result=await loadPublicXProfile(username.trim(),controller.signal);if(!controller.signal.aborted){setCandidate(result);onSearch(username.trim());}}
    catch(e){if(!controller.signal.aborted){const message=e instanceof Error?e.message:'Profil indisponible.';setError(message);onSearch(username.trim(),message);}}
    finally{if(!controller.signal.aborted)setBusy(false);}
  }
  const exists=candidate&&authorized.some(profile=>profile.id===candidate.id);
  return createPortal(<dialog ref={dialog} className="add-profile-dialog source-x-panel" aria-labelledby="add-profile-title" onCancel={onClose}>
    <header className="add-profile-heading"><div><span>PROFILS X</span><h2 id="add-profile-title">Ajouter un profil</h2></div><button type="button" onClick={onClose} aria-label="Fermer la recherche de profil"><X size={19}/></button></header>
    <div className="add-profile-body"><form onSubmit={e=>{e.preventDefault();void search();}}><label htmlFor="source-x-username">Nom d’utilisateur exact</label><div><input id="source-x-username" value={query} onChange={e=>onQuery(e.target.value)} placeholder="@NASA" pattern="@?[A-Za-z0-9_]{1,15}" maxLength={16} required autoFocus/><button type="submit" disabled={busy}><Search size={14}/>{busy?'Recherche…':'Rechercher'}</button></div></form>
    {error&&<p className="pw-error" role="alert">{error}</p>}
    {busy&&<p className="source-local-note" role="status">Lecture du profil et des publications publiques…</p>}
    {candidate&&<><XProfileDetails profile={candidate} onRefresh={()=>void search(candidate.username)} refreshing={busy}/><div className="add-profile-confirm"><button type="button" disabled={Boolean(exists)} onClick={()=>onAdd(candidate)}>{exists?'Profil déjà ajouté':'Ajouter aux profils autorisés'}</button></div></>}
    {!candidate&&!busy&&!error&&<p className="profile-search-empty">Recherchez un profil pour consulter ses informations et ses publications avant de l’ajouter.</p>}
    </div>
  </dialog>,document.body);
}
