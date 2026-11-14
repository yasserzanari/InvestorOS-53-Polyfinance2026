import { ThinkingState, type TraceNode } from './ai-agent-response';

/** Render actual API activity. Autoplay is deliberately disabled: there is no fabricated reasoning. */
export function LiveActivity({ nodes, busy = false, label }: { nodes: TraceNode[]; busy?: boolean; label?: string }) {
  if (!nodes.length && !busy) return null;
  return <div className="w-full py-1" aria-busy={busy}>
    {busy && <div role="status" className="mb-1 flex items-center gap-2 text-[12px] text-neutral-500"><span className="size-3 animate-spin rounded-full border border-neutral-300 border-t-neutral-700 motion-reduce:animate-none" />{label || 'Bedrock prépare la réponse…'}</div>}
    {nodes.length > 0 && <ThinkingState key={`${nodes.length}-${nodes.map((node) => node.status).join('-')}`} nodes={nodes} autoPlay={false} defaultExpanded={busy} workingLabel={label || (busy ? 'Activité en cours' : 'Activité terminée')} />}
  </div>;
}
export type { TraceNode } from './ai-agent-response';
