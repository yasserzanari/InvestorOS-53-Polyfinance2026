import type { ResearchEvent, ResearchRun } from '../profiles/research-workspace';

export const runStatus: Record<string, string> = { queued: 'En attente', running: 'Recherche en cours', loading: 'Chargement', complete: 'Analyse terminée', completed: 'Analyse terminée', partial: 'Résultat partiel', failed: 'Recherche interrompue', cancelled: 'Recherche annulée' };
export function contentRecord(input: unknown): Record<string, unknown> {
  let value = input;
  for (let i = 0; i < 5 && typeof value === 'string'; i++) {
    try { value = JSON.parse(value); } catch { return { excerpt: value }; }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function sourceHost(url?: string) {
  try { return new URL(url || '').hostname.replace(/^www\./, ''); } catch { return 'Source en préparation'; }
}
export function eventTime(value?: string) {
  return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('fr-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value)) : '';
}
export function sourceMethod(method?: string) {
  if (method?.includes('api_anything')) return 'API Anything';
  if (method?.includes('browser')) return 'Navigateur AgentCore';
  if (method === 'official_document_read') return 'Document officiel';
  if (method === 'deterministic_dataset_calculation') return 'Calcul sur historique';
  return 'Collecte documentaire';
}
export function agentLabel(id?: string) {
  if (id === 'coordinator') return 'Planificateur';
  if (id === 'verifier') return 'Vérification & synthèse';
  return (id || 'Recherche').replace(/^research-/, '').replace(/-/g, ' ');
}
export function observedAgents(run: ResearchRun) {
  const groups = new Map<string, ResearchEvent[]>();
  for (const event of run.events || []) if (event.agent_id) groups.set(event.agent_id, [...(groups.get(event.agent_id) || []), event]);
  return [...groups].map(([id, events]) => {
    const last = events.at(-1)!;
    const failed = events.some(event => event.type === 'source_unavailable' || event.status === 'failed');
    const done = ['evidence_saved', 'room_finished', 'calculation_completed'].includes(last.type) || last.status === 'done';
    return { id, events, last, status: failed ? 'failed' : done ? 'done' : 'running', label: agentLabel(id), role: ['coordinator', 'verifier'].includes(id) ? 'Agent Bedrock' : 'Collecteur de sources' };
  });
}
