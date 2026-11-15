import { authenticatedFetch } from '../../shared/auth';

export type Citation = { id: string; index: number; title: string; url: string; snippet?: string };
export type FollowUp = { id: string; label: string };
export type WorkspaceTab = { id: string; title: string; kind: 'profile'|'note'|'tasks'|'agents'|'sources'|'simulation'; content: string; items?: {id: string; title: string; status?: string; url?: string}[] };
export type ToolEvent = { id: string; name: string; status: 'running'|'done'|'failed'; input?: unknown; output?: unknown; error?: string };
export type AgentEvent = { id: string; name: string; status: 'running'|'done'|'failed'; task: string; summary?: string; startedAt?: number; durationMs?: number };
export type ProfileEvent = {type: string; [key: string]: unknown};
export const profileApiBase = import.meta.env.DEV
  ? (import.meta.env.VITE_API_TARGET ? '/api' : '/profile-api')
  : (import.meta.env.VITE_API_BASE_URL || '');

export async function streamProfile(body: unknown, signal: AbortSignal, onEvent: (event: ProfileEvent) => void) {
  const response = await authenticatedFetch(`${profileApiBase}/v1/profiles/chat`, { method:'POST', headers:{'Content-Type':'application/json',Accept:'application/x-ndjson'}, body:JSON.stringify(body), signal });
  if (!response.ok) throw new Error(`L’API est indisponible (${response.status}).`);
  if (!response.body) throw new Error('Le navigateur ne prend pas en charge ce flux.');
  const reader=response.body.getReader(); const decoder=new TextDecoder(); let pending=''; let ended=false;
  try {
    while(true) {
      const {value,done}=await reader.read(); pending+=decoder.decode(value,{stream:!done});
      const lines=pending.split('\n'); pending=lines.pop() || '';
      for(const line of lines) if(line.trim()) {const event=JSON.parse(line) as ProfileEvent; onEvent(event); if(event.type==='done'||event.type==='error') ended=true;}
      if(done) break;
    }
    if(pending.trim()) {const event=JSON.parse(pending) as ProfileEvent; onEvent(event); if(event.type==='done'||event.type==='error') ended=true;}
    if(!ended) throw new Error('La connexion a été interrompue avant la fin de la réponse.');
  } finally {reader.releaseLock();}
}

export const createLocalId = () => globalThis.crypto?.randomUUID?.() ?? `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const sourceUrl = (url: string) => url.startsWith("/api/v1/profiles/") ? `${profileApiBase}${url.slice(4)}` : url;

export function safeSourceUrl(url: string) { const resolved=sourceUrl(url); try { const parsed=new URL(resolved,window.location.origin); return ["http:","https:"].includes(parsed.protocol)?resolved:"#"; } catch { return "#"; } }
