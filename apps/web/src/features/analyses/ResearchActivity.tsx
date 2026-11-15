import { useMemo, useState } from 'react';
import { Background, Controls, Handle, Position, ReactFlow, type Node, type NodeProps } from '@xyflow/react';
import { Activity, ArrowUpRight, Bot, Braces, Check, ChevronRight, CircleAlert, FileText, Globe2, LoaderCircle, Search, ShieldCheck } from 'lucide-react';
import type { ResearchEvidence, ResearchRun } from '../profiles/research-workspace';
import { terminalResearch } from '../profiles/research-workspace';
import { sourceUrl } from '../analysis-interactions/presentation';
import { agentLabel, contentRecord, eventTime, observedAgents, sourceHost, sourceMethod } from './research-presentation';
import { ToolCallsSection } from './registry/ToolCallsSection';
import '@xyflow/react/dist/style.css';

type AgentNode = Node<{ label: string; role: string; status: string; detail: string; selected: boolean }, 'researchAgent'>;
function ResearchAgentNode({ data }: NodeProps<AgentNode>) {
  const Icon = data.status === 'done' ? Check : data.status === 'failed' ? CircleAlert : LoaderCircle;
  return <div className={`ra-agent-node ${data.selected ? 'is-selected' : ''}`}><Handle type="target" position={Position.Top}/><span className={`ra-node-icon is-${data.status}`}><Bot size={17}/></span><div><strong>{data.label}</strong><small>{data.role}</small></div><p>{data.detail}</p><footer><Icon size={12} className={data.status === 'running' ? 'ra-spin' : ''}/>{data.status === 'done' ? 'Résultat reçu' : data.status === 'failed' ? 'Lecture indisponible' : 'Opération observée'}</footer><Handle type="source" position={Position.Bottom}/></div>;
}
const nodeTypes = { researchAgent: ResearchAgentNode };

function DocumentPreview({ proof }: { proof: ResearchEvidence }) {
  const [tab, setTab] = useState<'document' | 'data'>('document');
  const content = contentRecord(proof.content);
  const documents = (Array.isArray(content.documents) ? content.documents : []).map(contentRecord);
  const image = sourceUrl(typeof content.image_url === 'string' ? content.image_url : typeof content.imageUrl === 'string' ? content.imageUrl : undefined);
  const excerpt = [content.excerpt, content.text, content.scope, content.source_limitations].find(value => typeof value === 'string' && value.length) as string | undefined;
  return <div className="ra-source-reader"><div className="ra-address"><Globe2 size={13}/><span title={proof.url}>{sourceHost(proof.url)}</span>{sourceUrl(proof.url) && <a href={sourceUrl(proof.url)} target="_blank" rel="noreferrer" aria-label="Ouvrir le site de la source"><ArrowUpRight size={14}/></a>}</div><div className="ra-reader-tabs"><button type="button" aria-pressed={tab === 'document'} onClick={() => setTab('document')}><FileText size={12}/>Document</button><button type="button" aria-pressed={tab === 'data'} onClick={() => setTab('data')}><Braces size={12}/>Données reçues</button><span>{sourceMethod(proof.method)}</span></div>
    {tab === 'data' ? <pre className="ra-json">{JSON.stringify(content, null, 2)}</pre> : <div className="ra-document"><span className="ra-document-icon"><FileText size={21}/></span><h4>{proof.source_name || proof.source_id}</h4>{image && <img src={image} alt="Visuel fourni par la source" loading="lazy" onError={e => { e.currentTarget.hidden = true; }}/>}<p>{excerpt || (documents.length ? 'Documents extraits de cette source.' : 'Les données structurées de cette source sont consultables dans « Données reçues ».')}</p>{documents.slice(0, 4).map((doc, index) => <article key={index}><strong>{String(doc.title || doc.form || 'Document lu')}</strong>{typeof doc.excerpt === 'string' && <p>{doc.excerpt.slice(0, 900)}</p>}{typeof doc.url === 'string' && sourceUrl(doc.url) && <a href={sourceUrl(doc.url)} target="_blank" rel="noreferrer">Lire le document <ArrowUpRight size={12}/></a>}</article>)}{proof.limits && <p className="ra-source-limits">{proof.limits}</p>}</div>}
    <footer><Check size={12}/>Contenu reçu{proof.collected_at ? ` · ${eventTime(proof.collected_at)}` : ''}</footer>
  </div>;
}

export function ResearchActivity({ run, canvas = false }: { run: ResearchRun; canvas?: boolean }) {
  const [selected, setSelected] = useState<string>();
  const [agent, setAgent] = useState<string>();
  const [tab, setTab] = useState<'sources' | 'journal'>('sources');
  const agents = useMemo(() => observedAgents(run), [run.events]);
  const events = run.events || [];
  const proofs = run.evidence || [];
  const selectedProof = proofs.find(proof => proof.evidence_id === selected) || proofs.at(-1);
  const active = !terminalResearch(run.status);
  const filtered = agent ? events.filter(event => event.agent_id === agent) : events;
  const latest = [...events].reverse().find(event => event.type === 'source_opened');
  const { nodes, edges } = useMemo(() => {
    const collectors = agents.filter(item => !['coordinator', 'verifier'].includes(item.id));
    const nodes: AgentNode[] = agents.map(item => ({ id: item.id, type: 'researchAgent', position: item.id === 'coordinator' ? { x: 280, y: 0 } : item.id === 'verifier' ? { x: 280, y: 220 + Math.ceil(collectors.length / 3) * 200 } : { x: (collectors.findIndex(c => c.id === item.id) % 3) * 280, y: 190 + Math.floor(collectors.findIndex(c => c.id === item.id) / 3) * 200 }, data: { label: item.label, role: item.role, status: item.status, detail: item.last.title, selected: agent === item.id } }));
    const plan = events.find(event => event.type === 'room_finished' && event.agent_id === 'coordinator');
    const tasks = (plan?.data as { tasks?: { agent_id?: string }[] } | undefined)?.tasks || [];
    const edges = tasks.filter(task => task.agent_id && nodes.some(node => node.id === task.agent_id) && nodes.some(node => node.id === 'coordinator')).map(task => ({ id: `plan-${task.agent_id}`, source: 'coordinator', target: task.agent_id!, type: 'smoothstep', style: { stroke: '#9fb4d7', strokeWidth: 1.5 } }));
    return { nodes, edges };
  }, [agents, agent, events]);
  const calls = (events.filter(event => event.type === 'skills_loaded')).flatMap(event => (event.data?.trace || []).map((trace, index) => ({ tool_name: trace.tool || 'skill', tool_category: 'skills', tool_call_id: `${event.event_id}-${index}`, message: trace.input?.skill_id ? `Chargement · ${trace.input.skill_id}` : trace.tool === 'search_skills' ? 'Recherche de procédures' : trace.tool || 'Procédure', inputs: trace.input as Record<string, unknown>, integration_name: agentLabel(event.agent_id) })));
  return <section className={`ra-root ${canvas ? 'is-canvas' : ''}`} aria-label="Suivi de la recherche"><header className="ra-header"><div><span className={`ra-header-icon ${active ? 'is-active' : ''}`}><Activity size={17}/></span><div><h3>{active ? 'La recherche avance' : 'Carnet de recherche'}</h3><p>{agents.length} intervenants · {proofs.length} sources reçues</p></div></div><span className="ra-activity-state">{active ? <LoaderCircle size={13} className="ra-spin"/> : <Check size={13}/>} {active ? 'En cours' : 'Archivé'}</span></header>
    {canvas && <><div className="ra-canvas-intro"><div><h4>Les intervenants de cette analyse</h4><p>Sélectionnez un intervenant pour lire ses opérations. Les connexions proviennent du plan enregistré.</p></div>{agent && <button type="button" onClick={() => setAgent(undefined)}>Tous les intervenants</button>}</div><div className="ra-canvas">{nodes.length ? <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.3} maxZoom={1.5} nodesDraggable={false} nodesConnectable={false} edgesFocusable={false} onNodeClick={(_, node) => { setAgent(current => current === node.id ? undefined : node.id); setTab('journal'); }}><Background gap={22} color="#dbe5f3"/><Controls showInteractive={false}/></ReactFlow> : <div className="ra-awaiting"><Search size={22}/><p>Le plan de recherche apparaîtra dès sa réception.</p></div>}</div></>}
    <div className="ra-sections"><div className="ra-switch"><button type="button" aria-pressed={tab === 'sources'} onClick={() => setTab('sources')}><Globe2 size={13}/>Sources <span>{proofs.length}</span></button><button type="button" aria-pressed={tab === 'journal'} onClick={() => setTab('journal')}><Activity size={13}/>Journal <span>{filtered.length}</span></button></div>
    {tab === 'sources' ? <>{proofs.length ? <><div className="ra-source-list" aria-label="Sources collectées">{proofs.map(proof => <button type="button" key={proof.evidence_id} aria-pressed={proof.evidence_id === selectedProof?.evidence_id} onClick={() => setSelected(proof.evidence_id)}><span className="ra-source-icon">{proof.method?.includes('api_anything') ? <Braces size={16}/> : <Globe2 size={16}/>}</span><span><strong>{proof.source_name || proof.source_id}</strong><small>{sourceMethod(proof.method)}</small></span><Check size={12}/><ChevronRight size={12}/></button>)}</div>{selectedProof && <DocumentPreview key={selectedProof.evidence_id} proof={selectedProof}/>}</> : <div className="ra-awaiting"><Globe2 size={24}/><h4>{latest ? sourceHost(latest.data?.url) : 'Les sources se préparent'}</h4><p>{latest?.detail || 'Les documents et données apparaîtront ici au fil des collectes.'}</p>{latest?.data?.url && sourceUrl(latest.data.url) && <a href={sourceUrl(latest.data.url)} target="_blank" rel="noreferrer">Ouvrir la source <ArrowUpRight size={13}/></a>}</div>}</> : <div className="ra-journal" role="log" aria-label="Opérations enregistrées" aria-live={active ? 'polite' : 'off'}>{filtered.length ? [...filtered].reverse().map(event => { const Icon = event.status === 'failed' ? CircleAlert : event.type === 'evidence_saved' ? FileText : event.agent_id === 'verifier' ? ShieldCheck : event.type === 'source_opened' ? Globe2 : Check; return <article key={event.event_id}><span className={`ra-log-icon ${event.status === 'failed' ? 'is-failed' : ''}`}><Icon size={14}/></span><div><strong>{event.title}</strong><p>{event.detail}</p><small>{agentLabel(event.agent_id)} · <time dateTime={event.at}>{eventTime(event.at)}</time></small>{sourceUrl(event.data?.url) && <a href={sourceUrl(event.data?.url)} target="_blank" rel="noreferrer">{sourceHost(event.data?.url)} <ArrowUpRight size={11}/></a>}</div></article>; }) : <p>En attente du premier événement du serveur.</p>}</div>}
    </div>{calls.length > 0 && <div className="ra-tool-calls"><ToolCallsSection toolCalls={calls} maxIconsToShow={4}/></div>}{run.events_truncated && <p className="ra-source-limits">L’historique reçu est partiel.</p>}
  </section>;
}
