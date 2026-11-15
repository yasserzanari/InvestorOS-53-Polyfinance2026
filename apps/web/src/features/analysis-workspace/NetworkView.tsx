import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Background, Controls, Handle, Position, MarkerType, type Node, type NodeProps, type Edge, type NodeChange, type EdgeChange, type ReactFlowInstance, useNodesState } from '@xyflow/react';
import { Box, Building2, ChevronRight, Factory, Flag, GitBranch, Cpu, MemoryStick, BookOpen, X, Maximize2, PanelRightClose, PanelRightOpen, Ship, Truck } from 'lucide-react';
import type { ExploreHandler } from '../analysis-interactions/types';
import { entityTarget, relationTarget, evidenceTarget, scenarioTarget, type AnalysisResult, type Entity, type Evidence, type Relation, type Risk, type ViewProps } from './types';
import '@xyflow/react/dist/style.css';
import './network.css';
import { ForecastChart } from './ForecastChart';
import { documentedRoles, focalEntity, graphLayout, type NetworkRole } from './network-presentation';
import './network-detail.css';

const riskLabels: Record<Risk, string> = { unknown: 'Non évalué', low: 'Faible', medium: 'Modéré', high: 'Élevé' };
const riskColors: Record<Risk, string> = { unknown: '#718096', low: '#2875e8', medium: '#e99a23', high: '#e44e5a' };
const kindLabels: Record<Entity['kind'], string> = { supplier: 'Fournisseur', component: 'Composant', site: 'Site', port: 'Port', product: 'Produit', policy: 'Politique' };
const icons = { supplier: Factory, component: Box, site: Building2, port: Ship, product: Truck, policy: Flag };
type GraphNode = Node<{ entity: Entity; connected: boolean; focal: boolean; relations: number; maxRelations: number; sources: number; roles: NetworkRole[]; onSource?:()=>void }, 'analysis'>;
function AnalysisNode({ data }: NodeProps<GraphNode>) {
  const Icon = data.focal ? Building2 : data.entity.kind === 'component' ? Cpu : icons[data.entity.kind];
  const color = data.focal ? '#356ce0' : data.roles[0]?.color || '#7186a5';
  const share = data.entity.share;
  const value = share === undefined ? data.relations : share;
  const ratio = share === undefined ? data.relations / Math.max(1, data.maxRelations) * 100 : Math.max(0, Math.min(100, share));
  return <div className={`av-graph-node nd-node${data.focal?' is-focal':''}${data.connected?' is-path':''}`} style={{'--node-color':color} as React.CSSProperties}>
    <Handle type="target" position={Position.Bottom}/>
    <div className="nd-node-heading"><span className="nd-node-icon"><Icon size={21}/></span><div><strong>{data.entity.label}</strong><span>{data.focal?'Entreprise étudiée':kindLabels[data.entity.kind]}{data.entity.country?` · ${data.entity.country}`:''}</span></div></div>
    <div className="nd-node-roles">{data.roles.map(role=><span key={role.id}>{role.id==='memory'?<MemoryStick size={12}/>:role.id==='wafers'?<Cpu size={12}/>:<Factory size={12}/>} {role.category}</span>)}{!data.roles.length&&<span>{data.focal?'Centre des dépendances':kindLabels[data.entity.kind]}</span>}</div>
    <div className="nd-node-metric"><span>{share===undefined?'Relations documentées':'Part déclarée'}</span><b>{value}{share===undefined?'':' %'}</b></div>
    <div className="nd-node-bar" aria-hidden="true"><i style={{width:`${ratio}%`}}/></div>
    <div className="nd-node-footer">{data.onSource?<button type="button" className="nodrag nopan nd-node-source" aria-label={`Lire les sources de ${data.entity.label}`} onClick={event=>{event.stopPropagation();data.onSource?.();}} onKeyDown={event=>event.stopPropagation()}><BookOpen size={11}/>{data.sources} source{data.sources!==1?'s':''}</button>:<span><BookOpen size={11}/>{data.sources} source{data.sources!==1?'s':''}</span>}{data.entity.risk!=='unknown'&&<span className={`av-risk is-${data.entity.risk}`}>{riskLabels[data.entity.risk]}</span>}</div>
    <Handle type="source" position={Position.Top}/>
  </div>;
}
const nodeTypes = { analysis: AnalysisNode };

export function EvidenceLinks({ evidence, ids, result, onExplore }: { evidence: Evidence[]; ids: string[]; result?:AnalysisResult; onExplore?:ExploreHandler }) {
  const sources = evidence.filter(item => ids.includes(item.id));
  return <div className="av-evidence"><h4>Éléments de preuve</h4>{sources.length ? sources.map(source => {
    let safe = false; try { safe = ['https:', 'http:'].includes(new URL(source.url).protocol); } catch { /* Invalid source URL stays text. */ }
    return <div key={source.id}>{onExplore&&result?<button type="button" className="av-source-explore" onClick={()=>onExplore(evidenceTarget(result,source))}>{source.title}</button>:safe ? <a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a> : <strong>{source.title}</strong>}<small>{source.publisher} · {source.publishedAt}</small>{source.excerpt && <p>{source.excerpt}</p>}</div>;
  }) : <p className="av-muted">Aucune preuve reliée à cet élément.</p>}</div>;
}

export function NetworkView({ result, mode, onExplore }: ViewProps & { mode: 'propagation' | 'dependencies' }) {
  const [selected, setSelected] = useState<string | null>(null);
  const positions = useRef<Record<string, { x: number; y: number }>>({});
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<GraphNode>([]);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<GraphNode, Edge> | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [inspector, setInspector] = useState(false);
  const canvas=useRef<HTMLDivElement>(null);
  const [canvasWidth,setCanvasWidth]=useState(720);
  const initialized=useRef('');
  useEffect(()=>{if(!canvas.current)return;const observer=new ResizeObserver(entries=>{const width=Math.round(entries[0]?.contentRect.width||0);if(width>0)setCanvasWidth(width);});observer.observe(canvas.current);return()=>observer.disconnect();},[]);
  const roles=useMemo(()=>documentedRoles(result),[result]);
  const maxRelations=Math.max(1,...result.entities.map(entity=>result.relations.filter(edge=>edge.source===entity.id||edge.target===entity.id).length));
  const [kind, setKind] = useState('all');
  const [roleFilter,setRoleFilter]=useState<string|null>(null);
  const [risk, setRisk] = useState('all');
  const [tier, setTier] = useState('all');
  const [showAlternatives, setShowAlternatives] = useState(true);
  const [showLogistics, setShowLogistics] = useState(false);
  const [pathOnly, setPathOnly] = useState(false);
  const changeNodes = useCallback((changes: NodeChange<GraphNode>[]) => {
    onNodesChange(changes);
    changes.forEach(change => {
      if (change.type === 'select' && change.selected) { setSelected(change.id); setSelectedEdge(null);setInspector(true); }
      if (change.type === 'position' && change.position) positions.current[`${result.analysisId}:${mode}:${change.id}`] = change.position;
    });
  }, [onNodesChange, result, mode, onExplore]);
  const changeEdges = useCallback((changes: EdgeChange<Edge>[]) => {
    changes.forEach(change => { if (change.type === 'select' && change.selected) { setSelectedEdge(change.id); setSelected(null);setInspector(true); } });
  }, [result,onExplore]);
  const path = useMemo(() => {
    const ids = new Set<string>();
    if (!selected) return ids;
    ids.add(selected);
    // Trace both directions independently so sibling branches do not join the selected path.
    for (const direction of ['source', 'target'] as const) {
      const visited = new Set([selected]); const queue = [selected];
      while (queue.length) {
        const id = queue.shift()!;
        result.relations.forEach(edge => {
          if (!showAlternatives && edge.kind === 'alternative') return;
          const from = direction === 'source' ? edge.source : edge.target;
          const to = direction === 'source' ? edge.target : edge.source;
          if (from === id && !visited.has(to)) { visited.add(to); ids.add(to); queue.push(to); }
        });
      }
    }
    return ids;
  }, [result, selected, showAlternatives]);
  const { nodes, edges, layout } = useMemo(() => {
    const filteredRole=roles.find(role=>role.id===roleFilter);
    const centerId=focalEntity(result)?.id;
    const visible = result.entities.filter(entity => (!filteredRole||filteredRole.supplierIds.includes(entity.id)||entity.id===centerId)&& (showLogistics || (entity.kind !== 'port' && result.relations.some(edge => edge.kind !== 'transport' && (edge.source === entity.id || edge.target === entity.id)))) && (kind === 'all' || entity.kind === kind) && (risk === 'all' || entity.risk === risk) && (tier === 'all' || entity.kind !== 'supplier' || entity.tier === Number(tier)) && (!pathOnly || !selected || path.has(entity.id)));
    const ids = new Set(visible.map(entity => entity.id));
    const layout=graphLayout(visible,result,canvasWidth,mode);
    const nodes: GraphNode[] = visible.map(entity => ({
      id:entity.id,type:'analysis',style:{width:layout.cardWidth},
      position:positions.current[`${result.analysisId}:${mode}:${entity.id}`]||layout.positions[entity.id]||{x:0,y:0},
      data:{entity,connected:path.has(entity.id),focal:entity.id===layout.focalId,relations:result.relations.filter(edge=>edge.source===entity.id||edge.target===entity.id).length,maxRelations,sources:new Set(entity.evidenceIds).size,roles:roles.filter(role=>role.supplierIds.includes(entity.id)),onSource:onExplore&&result.evidence.some(proof=>entity.evidenceIds.includes(proof.id))?()=>{const proof=result.evidence.find(item=>entity.evidenceIds.includes(item.id));if(proof)onExplore(evidenceTarget(result,proof));}:undefined},
      selected:entity.id===selected,ariaLabel:`${entity.label}, ${entity.id===layout.focalId?'entreprise étudiée':kindLabels[entity.kind]}`,
    }));
    const edges: Edge[] = result.relations.filter(edge => ids.has(edge.source) && ids.has(edge.target) && (showAlternatives || edge.kind !== 'alternative') && (showLogistics || edge.kind !== 'transport')).map(edge => {
      const highlighted = Boolean(selected && path.has(edge.source) && path.has(edge.target));
      const color = edge.kind === 'alternative' ? '#2aa26d' : riskColors[edge.risk];
      return { id: edge.id, source: edge.source, target: edge.target, label: selectedEdge === edge.id ? edge.label : undefined, type: 'smoothstep', selected: selectedEdge === edge.id, style: { stroke: color, strokeWidth: highlighted ? 3 : 1.7, strokeDasharray: edge.kind === 'alternative' ? '6 4' : undefined, opacity: selected && !highlighted ? .22 : .7 }, markerEnd: { type: MarkerType.ArrowClosed, color }, labelStyle: { fontSize: 10, fill: '#536782' }, labelBgStyle: { fill: '#fff', fillOpacity: .95 }, ariaLabel: edge.label };
    });
    return { nodes, edges, layout };
  }, [result, mode, kind, risk, tier, showAlternatives, showLogistics, pathOnly, selected, selectedEdge, path, canvasWidth, maxRelations, roles, roleFilter, onExplore]);
  useEffect(() => { setFlowNodes(nodes); }, [nodes, setFlowNodes]);
  useEffect(() => {
    if(!flowInstance||!nodes.length)return;
    const signature=`${result.analysisId}:${mode}:${kind}:${risk}:${tier}:${showAlternatives}:${showLogistics}:${pathOnly}:${canvasWidth}:${roleFilter}`;
    if(initialized.current===signature)return;
    initialized.current=signature;
    const frame=requestAnimationFrame(()=>{
      const zoom=Math.min(1,Math.max(.8,(canvasWidth-48)/Math.max(1,layout.contentWidth)));
      void flowInstance.setViewport({x:(canvasWidth-layout.contentWidth*zoom)/2,y:44,zoom},{duration:0});
    });
    return()=>cancelAnimationFrame(frame);
  },[flowInstance,result.analysisId,mode,kind,risk,tier,showAlternatives,showLogistics,pathOnly,canvasWidth,nodes.length,layout.contentWidth,roleFilter]);
  useEffect(() => { positions.current = {}; setSelected(null); setSelectedEdge(null); }, [result.analysisId, mode]);
  useEffect(() => { if (!selected) setPathOnly(false); }, [selected]);
  const entity = result.entities.find(item => item.id === selected && nodes.some(node => node.id === item.id));
  const relation = result.relations.find(item => item.id === selectedEdge && edges.some(edge => edge.id === item.id));
  const incident = entity ? result.relations.filter(item => item.source === entity.id || item.target === entity.id) : [];
  const closeDetails=()=>{setInspector(false);if(selected)requestAnimationFrame(()=>{const node=canvas.current?.querySelector(`[data-id="${CSS.escape(selected)}"]`) as HTMLElement|null;node?.focus();});};
  const tiers = [...new Set(result.entities.flatMap(item => item.tier === undefined ? [] : [item.tier]))].sort();
  const kinds = [...new Set(result.entities.map(item => item.kind))];
  const proofIds=new Set([...nodes.flatMap(node=>node.data.entity.evidenceIds),...result.relations.filter(edge=>edges.some(item=>item.id===edge.id)).flatMap(edge=>edge.evidenceIds)]);
  return <section className="av-network nd-network" aria-label={mode === 'propagation' ? 'Propagation des risques' : 'Dépendances de la chaîne'}>
    <div className="av-network-controls">
      {roleFilter&&<button type="button" className="nd-clear-role" onClick={()=>setRoleFilter(null)}>{roles.find(role=>role.id===roleFilter)?.category}<X size={12}/></button>}
      <label>Afficher <select aria-label="Afficher" value={kind} onChange={event => { setKind(event.target.value); if (event.target.value === 'port') setShowLogistics(true); }}><option value="all">Tous les éléments</option>{kinds.map(item => <option key={item} value={item}>{kindLabels[item]}</option>)}</select></label>
      <label>Risque <select aria-label="Risque" value={risk} onChange={event => setRisk(event.target.value)}><option value="all">Tous</option>{Object.entries(riskLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      {tiers.length>0&&<label>Rang fournisseurs <select aria-label="Rang fournisseurs" value={tier} onChange={event => setTier(event.target.value)}><option value="all">Tous</option>{tiers.map(item => <option key={item} value={item}>{item}</option>)}</select></label>}
      {result.relations.some(edge=>edge.kind==='alternative')&&<label className="av-check"><input type="checkbox" checked={showAlternatives} onChange={event => setShowAlternatives(event.target.checked)}/>Alternatives</label>}
      {result.relations.some(edge=>edge.kind==='transport')&&<label className="av-check"><input type="checkbox" checked={showLogistics} onChange={event => setShowLogistics(event.target.checked)}/>Logistique</label>}
      <label className="av-check"><input type="checkbox" disabled={!selected} checked={pathOnly} onChange={event => setPathOnly(event.target.checked)}/>Chemin sélectionné</label>
      <button type="button" className="av-icon-button" aria-label={inspector ? 'Replier les détails' : 'Ouvrir les détails'} aria-expanded={inspector} onClick={() => inspector?closeDetails():setInspector(true)}>{inspector ? <PanelRightClose size={17}/> : <PanelRightOpen size={17}/>}</button>
    </div>
    <div className="nd-network-summary"><span><Factory size={14}/><b>{nodes.length}</b> éléments</span><span><GitBranch size={14}/><b>{edges.length}</b> relations</span><span><BookOpen size={14}/><b>{proofIds.size}</b> source{proofIds.size!==1?'s':''}</span>{roles.length>0&&<span><Cpu size={14}/><b>{roles.length}</b> fonctions documentées</span>}</div>
    <div className={`av-canvas-layout nd-canvas-layout${inspector ? ' has-inspector' : ''}`}>
      <div className="av-network-canvas" onKeyDownCapture={event=>{if(event.key!=='Enter'&&event.key!==' ')return;if((event.target as Element).closest('button,a,input,select'))return;const node=(event.target as Element).closest('.react-flow__node[data-id]');const id=node?.getAttribute('data-id');if(id){event.preventDefault();event.stopPropagation();setSelected(id);setSelectedEdge(null);setInspector(true);}}} ref={canvas} style={{height:Math.min(1100,Math.max(530,layout.contentHeight+88))}}>
        <div className="av-canvas-title"><GitBranch size={15}/><strong>{mode === 'propagation' ? 'Chaîne de propagation du risque' : 'Réseau de dépendances'}</strong><span>Glissez pour explorer</span></div>
        {nodes.length ? <ReactFlow key={`${result.analysisId}-${mode}`} nodes={flowNodes} onInit={setFlowInstance} onNodesChange={changeNodes} onEdgesChange={changeEdges} edges={edges} nodeTypes={nodeTypes} minZoom={.2} maxZoom={2} nodesDraggable nodesConnectable={false} deleteKeyCode={null} elementsSelectable onNodeClick={(_, node) => { setSelected(node.id);setSelectedEdge(null);setInspector(true); }} onEdgeClick={(_, edge) => { setSelectedEdge(edge.id);setSelected(null);setInspector(true); }} onPaneClick={() => { setSelected(null);setSelectedEdge(null);setInspector(false); }} onNodeDragStop={(_, node) => { positions.current[`${result.analysisId}:${mode}:${node.id}`] = node.position; }} proOptions={{ hideAttribution: false }}>
          <Background color="#dbe5f4" gap={22}/><Controls showInteractive={false}/><button type="button" className="nd-fit-readable" aria-label="Recentrer le réseau" title="Recentrer le réseau" onClick={()=>{const zoom=Math.min(1,(canvasWidth-48)/Math.max(1,layout.contentWidth));void flowInstance?.setViewport({x:(canvasWidth-layout.contentWidth*zoom)/2,y:44,zoom},{duration:180});}}><Maximize2 size={15}/></button>
        </ReactFlow> : <div className="av-canvas-empty">Aucun élément ne correspond aux filtres sélectionnés.</div>}
        <div className="nd-graph-caption"><span><Factory size={12}/> Fournisseur</span><span><Cpu size={12}/> Composant / fonction</span><span><Building2 size={12}/> Entreprise</span><small>Barres : mesure indiquée sur chaque carte.</small></div>
      </div>
      {inspector && <aside className="av-network-inspector nd-inspector" aria-label="Détails de la sélection"><button type="button" className="nd-close-inspector" aria-label="Fermer les détails du réseau" onClick={closeDetails}><X size={16}/></button>
        {entity ? <><div className="av-inspector-heading"><strong>{entity.label}</strong><span className={`av-risk is-${entity.risk}`}>{riskLabels[entity.risk]}</span></div><p>{entity.detail}</p>{onExplore&&<button type="button" className="av-explore-result" onClick={()=>onExplore(entityTarget(result,entity))}>Explorer cet élément</button>}<dl><div><dt>Type</dt><dd>{kindLabels[entity.kind]}</dd></div>{entity.country && <div><dt>Pays</dt><dd>{entity.country}</dd></div>}{entity.share !== undefined && <div><dt>Part déclarée</dt><dd>{entity.share} %</dd></div>}{entity.tier !== undefined && <div><dt>Rang</dt><dd>{entity.tier}</dd></div>}<div><dt>Relations</dt><dd>{incident.length}</dd></div></dl><h4>Éléments reliés</h4><div className="av-related-list">{incident.map(edge => { const target = result.entities.find(item => item.id === (edge.source === entity.id ? edge.target : edge.source)); return <button type="button" key={edge.id} onClick={() => { setSelected(target?.id || null); setSelectedEdge(null);setInspector(true); }}><span>{target?.label}<small>{edge.label}</small></span><ChevronRight size={14}/></button>; })}</div><EvidenceLinks result={result} onExplore={onExplore} evidence={result.evidence} ids={entity.evidenceIds}/></> : relation ? <><div className="av-inspector-heading"><strong>{relation.label}</strong><span className={`av-risk is-${relation.risk}`}>{riskLabels[relation.risk]}</span></div><RelationDetails relation={relation} result={result}/>{onExplore&&<button type="button" className="av-explore-result" onClick={()=>onExplore(relationTarget(result,relation))}>Explorer cette relation</button>}<EvidenceLinks result={result} onExplore={onExplore} evidence={result.evidence} ids={relation.evidenceIds}/></> : <div className="av-inspector-empty"><GitBranch size={24}/><strong>Explorer un chemin</strong><p>Sélectionnez un élément ou une relation pour consulter son rôle, ses dépendances et les preuves disponibles.</p></div>}
      </aside>}
    </div>
    {roles.length>0&&<section className="nd-role-bars" aria-label="Fonctions des fournisseurs"><header><h3>Fonctions documentées</h3><span>Nombre de fournisseurs cités</span></header>{roles.map(role=><button type="button" key={role.id} aria-pressed={roleFilter===role.id} onClick={()=>{setRoleFilter(value=>value===role.id?null:role.id);setKind('all');setRisk('all');setTier('all');setSelected(null);setSelectedEdge(null);setInspector(false);canvas.current?.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}}><span>{role.id==='memory'?<MemoryStick size={16}/>:role.id==='wafers'?<Cpu size={16}/>:<Factory size={16}/>}<strong>{role.label}</strong></span><i><b style={{width:`${role.supplierIds.length/Math.max(...roles.map(item=>item.supplierIds.length))*100}%`,background:role.color}}/></i><em>{role.supplierIds.length}</em></button>)}<p>Une entreprise peut intervenir dans plusieurs fonctions. Ces comptes ne sont pas des parts d’approvisionnement.</p></section>}
    <div className="av-network-bottom">
      <section className="av-network-watchlist"><h3>Données du réseau</h3><div className="av-network-watchlist-scroll"><table><thead><tr><th>Élément</th><th>Relations</th><th>Sources</th>{result.entities.some(item=>item.share!==undefined)&&<th>Part déclarée</th>}</tr></thead><tbody>{[...result.entities].sort((a, b) => ({ high: 0, medium: 1, low: 2, unknown: 3 }[a.risk] - { high: 0, medium: 1, low: 2, unknown: 3 }[b.risk])).map(item => <tr key={item.id} className={selected === item.id ? 'is-selected' : ''}><td><button type="button" onClick={() => { setKind('all'); setRisk('all'); setTier('all'); if (item.kind === 'port' || !result.relations.some(edge => edge.kind !== 'transport' && (edge.source === item.id || edge.target === item.id))) setShowLogistics(true); setSelected(item.id); setSelectedEdge(null); setInspector(true); }}>{item.label}<small>{kindLabels[item.kind]}</small></button></td><td>{result.relations.filter(edge=>edge.source===item.id||edge.target===item.id).length}</td><td>{new Set(item.evidenceIds).size}</td>{result.entities.some(item=>item.share!==undefined)&&<td>{item.share === undefined ? '—' : `${item.share} %`}</td>}</tr>)}</tbody></table></div></section>
      {result.scenarios.some(item=>item.series.length)&&<section className="av-network-forecast"><h3>Scénarios de coût · {result.costUnit}</h3>{result.scenarios.some(item => item.series.length) ? <ForecastChart compact onExplore={onExplore} series={result.scenarios.filter(item => item.series.length).map(item => ({ target:scenarioTarget(result,item), id: item.id, label: item.label, color: item.kind === 'base' ? '#2875e8' : item.kind === 'adverse' ? '#e44e5a' : '#25a36f', points: item.series, dashed: item.kind !== 'base' }))} unit={result.costUnit} height={150}/> : <p className="av-muted">Aucune série de coût fournie. Les relations et les preuves restent consultables dans le graphe.</p>}</section>}
    </div>
  </section>;
}
function RelationDetails({ relation, result }: { relation: Relation; result: AnalysisResult }) {
  return <dl><div><dt>Départ</dt><dd>{result.entities.find(item => item.id === relation.source)?.label}</dd></div><div><dt>Destination</dt><dd>{result.entities.find(item => item.id === relation.target)?.label}</dd></div><div><dt>Nature</dt><dd>{relation.kind}</dd></div>{relation.share !== undefined && <div><dt>Part déclarée</dt><dd>{relation.share} %</dd></div>}{relation.delayDays !== undefined && <div><dt>Délai déclaré</dt><dd>{relation.delayDays} jours</dd></div>}</dl>;
}
