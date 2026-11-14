import { useEffect, useState } from 'react';
import { AlertCircle, Bot, Check, Circle, Clock3, Network, Sparkles } from 'lucide-react';
import type { AgentEvent } from '../profile-api';

function elapsedLabel(agent: AgentEvent, now: number) {
  const elapsed = agent.durationMs ?? (agent.status === 'running' && agent.startedAt ? now - agent.startedAt : undefined);
  if (elapsed === undefined) return undefined;
  if (elapsed < 1000) return `${Math.max(1, elapsed)} ms`;
  const seconds = elapsed / 1000;
  return seconds < 60 ? `${seconds.toFixed(seconds < 10 ? 1 : 0)} s` : `${Math.floor(seconds / 60)} min ${Math.floor(seconds % 60)} s`;
}

const statusCopy = {
  running: 'En cours',
  done: 'Terminé',
  failed: 'Échec',
} as const;

function AgentStatusIcon({ status }: { status: AgentEvent['status'] }) {
  if (status === 'running') return <span aria-hidden="true" className="agent-workspace-spinner" />;
  if (status === 'done') return <Check size={13} aria-hidden="true" />;
  return <AlertCircle size={13} aria-hidden="true" />;
}

function AgentCard({ agent }: { agent: AgentEvent }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (agent.status !== 'running') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [agent.status]);

  const initials = agent.name.split(/\s+/).map((word) => word[0]).slice(0, 2).join('').toUpperCase();
  const duration = elapsedLabel(agent, now);

  return (
    <article className="agent-workspace-card" data-agent-status={agent.status}>
      <div className="agent-workspace-card-top">
        <span className="agent-workspace-avatar" aria-hidden="true">{initials || <Bot size={15} />}</span>
        <div className="agent-workspace-identity">
          <strong>{agent.name}</strong>
          <span>Spécialiste Bedrock</span>
        </div>
        <span className={`agent-workspace-status is-${agent.status}`} role="status">
          <AgentStatusIcon status={agent.status} />{statusCopy[agent.status]}
        </span>
      </div>

      <div className="agent-workspace-mission">
        <span className="agent-workspace-label">Mission</span>
        <p>{agent.task}</p>
      </div>

      {agent.summary ? (
        <div className="agent-workspace-result">
          <span className="agent-workspace-label">{agent.status === 'failed' ? 'État' : 'Résultat transmis'}</span>
          <p>{agent.summary}</p>
        </div>
      ) : agent.status === 'running' ? (
        <div className="agent-workspace-running" role="status">
          <span className="agent-workspace-pulse" />Le spécialiste prépare son retour.
        </div>
      ) : null}

      <div className="agent-workspace-card-footer">
        <span><Clock3 size={12} aria-hidden="true" />{duration ?? 'Durée indisponible'}</span>
        <span className="agent-workspace-call-id">Consultation réelle</span>
      </div>
    </article>
  );
}

export function AgentsWorkspace({ agents, busy, activity }: {
  agents: AgentEvent[];
  busy: boolean;
  activity: string;
}) {
  const recentAgents = agents.slice(-12).reverse();
  const completedCount = recentAgents.filter((agent) => agent.status === 'done').length;
  const runningCount = recentAgents.filter((agent) => agent.status === 'running').length;

  return (
    <section className="agent-workspace" aria-labelledby="agent-workspace-title">
      <header className="agent-workspace-heading">
        <div className="agent-workspace-heading-icon"><Network size={17} aria-hidden="true" /></div>
        <div>
          <h2 id="agent-workspace-title">Agents</h2>
          <p>Consultations réellement lancées par l’Assistant</p>
        </div>
        <span className="agent-workspace-count">{recentAgents.length} / 12</span>
      </header>

      <div className="agent-workspace-orchestration" data-running={busy ? 'true' : 'false'}>
        <span className="agent-workspace-orchestrator-icon"><Sparkles size={15} aria-hidden="true" /></span>
        <span className="agent-workspace-orchestrator-copy">
          <strong>Assistant InvestorOS</strong>
          <small>{busy ? activity || 'Coordination du tour en cours' : recentAgents.length ? 'Coordination du tour terminée' : 'Orchestrateur prêt'}</small>
        </span>
        <span className={`agent-workspace-orchestrator-state${busy ? ' is-running' : ''}`}>
          {busy ? <span className="agent-workspace-spinner" aria-hidden="true" /> : <Circle size={8} aria-hidden="true" />}
          {busy ? 'Actif' : recentAgents.length ? `${completedCount} terminé${completedCount === 1 ? '' : 's'}${runningCount ? ` · ${runningCount} en cours` : ''}` : 'En attente'}
        </span>
      </div>

      {recentAgents.length ? (
        <div className="agent-workspace-branch">
          <div className="agent-workspace-branch-line" aria-hidden="true" />
          <div className="agent-workspace-grid" aria-live="polite">
            {recentAgents.map((agent) => <AgentCard key={agent.id} agent={agent} />)}
          </div>
        </div>
      ) : (
        <div className="agent-workspace-empty">
          <span><Bot size={19} aria-hidden="true" /></span>
          <h3>Aucun spécialiste mobilisé pour l’instant</h3>
          <p>Quand l’Assistant lancera une consultation Bedrock, sa mission, son état et sa réponse apparaîtront ici.</p>
          {busy && <small role="status">Le tour actuel n’a pas encore demandé de spécialiste.</small>}
        </div>
      )}
    </section>
  );
}
