import { useEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '../../shared/auth';
import { profileApiBase, type WorkspaceTab, type Citation } from './profile-api';
import type { Profile } from './profile-model';
type State = {profile:Profile;tabs:WorkspaceTab[];sources:Citation[]};
function serializedMemory(state:State, conversationScoped:boolean) {
  return JSON.stringify(conversationScoped?{profile:state.profile}:{profile:state.profile,tabs:state.tabs,sources:state.sources});
}
export function useProfileMemory(accountId:string, state:State, restore:(profile:Profile,tabs:WorkspaceTab[],sources:Citation[])=>void, conversationScoped=false) {
  const [status,setStatus]=useState('Chargement de la mémoire…');
  const [ready,setReady]=useState('');
  const [retry,setRetry]=useState(0);
  const [tick,setRetryTick]=useState(0);
  const revision=useRef(0), lastSaved=useRef(''), saving=useRef(false), conflict=useRef(false);
  const sharedWorkspace=useRef<{tabs:WorkspaceTab[];sources:Citation[]}>({tabs:[],sources:[]});
  const owner=useRef(accountId);owner.current=accountId;
  const latest=useRef(state);latest.current=state;
  const restoreRef=useRef(restore);restoreRef.current=restore;
  useEffect(()=>{
    const controller=new AbortController();const account=accountId;
    setReady('');setStatus('Chargement de la mémoire…');conflict.current=false;saving.current=false;
    sharedWorkspace.current={tabs:[],sources:[]};
    authenticatedFetch(`${profileApiBase}/v1/profiles/memory/${account}`,{signal:controller.signal}).then(async response=>{
      if(!response.ok){const error=await response.json().catch(()=>null);throw Error(typeof error?.detail==='string'?error.detail:'Mémoire serveur indisponible');}
      const data=await response.json();if(controller.signal.aborted||owner.current!==account)return;
      revision.current=data.revision;
      sharedWorkspace.current={tabs:data.tabs??[],sources:data.sources??[]};
      const next={profile:data.profile??latest.current.profile,tabs:conversationScoped?latest.current.tabs:(data.profile?(data.tabs??[]):latest.current.tabs),sources:conversationScoped?latest.current.sources:(data.profile?(data.sources??[]):latest.current.sources)};
      lastSaved.current=data.profile?serializedMemory(next,conversationScoped):'';
      if(data.profile)restoreRef.current(next.profile,next.tabs,next.sources);
      setStatus(data.profile?'Mémoire restaurée':'Mémoire prête');setReady(account);
    }).catch(error=>{if(!controller.signal.aborted){setStatus(error.message+' · copie locale conservée');setReady('');}});
    return()=>controller.abort();
  },[accountId,retry,conversationScoped]);
  const serialized=serializedMemory(state,conversationScoped);
  useEffect(()=>{
    if(ready!==accountId||conflict.current||serialized===lastSaved.current)return;
    const account=accountId;
    const timer=window.setTimeout(async()=>{
      if(saving.current)return;
      saving.current=true;setStatus('Enregistrement…');
      try {
        const memory=conversationScoped?{profile:latest.current.profile,...sharedWorkspace.current}:{profile:latest.current.profile,tabs:latest.current.tabs,sources:latest.current.sources};
        const payload=JSON.stringify(memory);
        const response=await authenticatedFetch(`${profileApiBase}/v1/profiles/memory/${account}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...memory,expectedRevision:revision.current})});
        if(owner.current!==account)return;
        if(response.status===409){conflict.current=true;throw Error('Mémoire modifiée ailleurs : recharger');}
        if(!response.ok){const error=await response.json().catch(()=>null);throw Error(typeof error?.detail==='string'?error.detail:'Enregistrement serveur interrompu');}
        const data=await response.json();revision.current=data.revision;lastSaved.current=conversationScoped?JSON.stringify({profile:memory.profile}):payload;
        setStatus('Enregistré sur le serveur');
      } catch(error){conflict.current=true;if(owner.current===account)setStatus(error instanceof Error?error.message:'Mémoire indisponible');}
      finally {if(owner.current===account){saving.current=false;setRetryTick(v=>v+1);}}
    },650);
    return()=>clearTimeout(timer);
  },[serialized,ready,accountId,tick,conversationScoped]);
  return {status,ready:ready===accountId,reload:()=>setRetry(v=>v+1)};
}
