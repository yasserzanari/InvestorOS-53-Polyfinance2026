import { authenticatedFetch } from '../../shared/auth';

export type Citation = { id: string; index: number; title: string; url: string; snippet?: string };
export type FollowUp = { id: string; label: string };
export type WorkspaceTab = { id: string; title: string; kind: 'profile'|'note'|'tasks'|'agents'|'sources'|'simulation'|'decision'; content: string; items?: {id: string; title: string; status?: string; url?: string}[] };
export type ToolEvent = { actor?:string; phase?: 'preparing'|'executing'; startedAt?:number; finishedAt?:number; id: string; name: string; status: 'running'|'done'|'failed'; input?: unknown; output?: unknown; error?: string };
export type AgentEvent = { id: string; name: string; status: 'running'|'done'|'failed'; task: string; summary?: string; startedAt?: number; durationMs?: number; kind?: 'bedrock'|'collector'; skills?: {id:string;version?:string;sha256?:string}[]; skill_trace?: {tool:string;actor?:string;input?:{skill_id?:string}}[] };
export type ProfileEvent = {type: string; [key: string]: unknown};
export const profileApiBase = import.meta.env.DEV
  ? (import.meta.env.VITE_API_TARGET ? '/api' : '/profile-api')
  : (import.meta.env.VITE_API_BASE_URL || '');

export async function readProfileApi(url: string, init: Omit<RequestInit, 'method'|'body'> = {}): Promise<Response> {
  const signal=init.signal;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await authenticatedFetch(url,{...init,method:'GET'});
      if(![429,500,502,503,504].includes(response.status)||attempt===2)return response;
      await response.body?.cancel().catch(()=>undefined);
    }catch(error){
      if(signal?.aborted||attempt===2||(error instanceof DOMException&&error.name==='AbortError'))throw error;
    }
    await new Promise<void>((resolve,reject)=>{
      const stop=()=>{clearTimeout(timer);signal?.removeEventListener('abort',stop);reject(new DOMException('Lecture arrêtée','AbortError'));};
      const timer=setTimeout(()=>{signal?.removeEventListener('abort',stop);resolve();},1000*(attempt+1));
      signal?.addEventListener('abort',stop,{once:true});
      if(signal?.aborted)stop();
    });
  }
  throw new Error('Lecture interrompue. Réessayez.');
}

export async function streamProfile(body: unknown, signal: AbortSignal, onEvent: (event: ProfileEvent) => void) {
  const statusResponse=await readProfileApi(`${profileApiBase}/v1/profiles/status`,{signal});
  if(!statusResponse.ok)throw new Error(`L’API est indisponible (${statusResponse.status}).`);
  const status=await statusResponse.json();
  if(status.chatTransport==='async')return pollProfileJob(body,signal,onEvent);
  const response = await authenticatedFetch(`${profileApiBase}/v1/profiles/chat`, { method:'POST', headers:{'Content-Type':'application/json',Accept:'application/x-ndjson'}, body:JSON.stringify(body), signal });
  if (!response.ok) throw new Error(`L’API est indisponible (${response.status}).`);
  if (!response.body) throw new Error('Le navigateur ne prend pas en charge ce flux.');
  const reader=response.body.getReader(); const decoder=new TextDecoder(); let pending=''; let ended=false;
  try {
    while(true) {
      const {value,done}=await reader.read(); pending+=decoder.decode(value,{stream:!done});
      const lines=pending.split('\n'); pending=lines.pop() || '';
      for(const line of lines) if(line.trim()) {const event=JSON.parse(line) as ProfileEvent; onEvent(event); if(event.type==='done'||event.type==='error') {ended=true;await reader.cancel().catch(()=>undefined);return;}}
      if(done) break;
    }
    if(pending.trim()) {const event=JSON.parse(pending) as ProfileEvent; onEvent(event); if(event.type==='done'||event.type==='error') ended=true;}
    if(!ended) throw new Error('La connexion a été interrompue avant la fin de la réponse.');
  } finally {reader.releaseLock();}
}

async function pollProfileJob(body: unknown, signal: AbortSignal, onEvent: (event: ProfileEvent) => void) {
  const accountId=(body as {accountId?:string}).accountId;
  if(!accountId)throw new Error('Compte de démonstration manquant.');
  const start=await authenticatedFetch(`${profileApiBase}/v1/profiles/chat/jobs`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
  if(!start.ok)throw new Error(`Le lancement de la réponse a échoué (${start.status}).`);
  const job=await start.json();
  if(typeof job.jobId!=='string'||!/^[0-9a-f-]{36}$/i.test(job.jobId))throw new Error('Identifiant de réponse invalide.');
  const endpoint=`${profileApiBase}/v1/profiles/chat/jobs/${job.jobId}`;
  const query=`accountId=${encodeURIComponent(accountId)}`;
  const cancel=()=>{void authenticatedFetch(`${endpoint}/cancel?${query}`,{method:'POST'}).catch(()=>undefined);};
  signal.addEventListener('abort',cancel,{once:true});
  if(signal.aborted)cancel();
  let cursor=0;
  const deadline=Date.now()+190000;
  try{
    onEvent({type:'status',label:'Réponse en préparation sur AWS'});
    while(!signal.aborted){
      const response=await readProfileApi(`${endpoint}?${query}&after=${cursor}`,{signal});
      if(!response.ok)throw new Error(`Le suivi de la réponse est indisponible (${response.status}).`);
      const result=await response.json();
      if(!Array.isArray(result.events)||!Number.isInteger(result.nextCursor)||result.nextCursor<cursor)throw new Error('Suivi de réponse invalide.');
      for(const event of result.events){
        onEvent(event);
        if(event.type==='done'||event.type==='error')return;
      }
      cursor=result.nextCursor;
      if(result.status==='failed')throw new Error(typeof result.error==='string'?result.error:'La réponse n’a pas abouti. Réessayez.');
      if(result.status==='cancelled')throw new DOMException('Réponse arrêtée','AbortError');
      if(result.status==='done')throw new Error('La réponse est terminée sans résultat final.');
      if(Date.now()>deadline)throw new Error('Le délai de suivi est dépassé. La réponse n’est pas présentée comme terminée.');
      await new Promise<void>((resolve,reject)=>{
        const aborted=()=>{clearTimeout(timer);reject(new DOMException('Réponse arrêtée','AbortError'));};
        const timer=setTimeout(()=>{signal.removeEventListener('abort',aborted);resolve();},800);
        signal.addEventListener('abort',aborted,{once:true});
        if(signal.aborted)aborted();
      });
    }
    throw new DOMException('Réponse arrêtée','AbortError');
  }finally{signal.removeEventListener('abort',cancel);}
}

export const createLocalId = () => globalThis.crypto?.randomUUID?.() ?? `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const sourceUrl = (url: string) => url.startsWith("/api/v1/profiles/") ? `${profileApiBase}${url.slice(4)}` : url;

export function safeSourceUrl(url: string) { const resolved=sourceUrl(url); try { const parsed=new URL(resolved,window.location.origin); return ["http:","https:"].includes(parsed.protocol)?resolved:"#"; } catch { return "#"; } }
