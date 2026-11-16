import { authenticatedFetch, useAuth } from '../../shared/auth';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowUpRight, BookOpen, Boxes, Check, ChevronRight, CircleHelp, Cloud, DollarSign, ExternalLink, Gauge, Globe2, LogOut, Maximize, Minus, Plus, RefreshCw, Search, ShieldAlert, ShieldCheck, Workflow, X } from 'lucide-react';
import { VoiceVocabularyPanel, type VoiceVocabulary } from './VoiceVocabularyPanel';
import { GuardrailsPanel } from './GuardrailsPanel';
import { SourceExplorer } from '../evidence/SourceExplorer';
import '../evidence/evidence.css';
import './admin.css';

type Metric = { points?: Array<{ at: string; value: number }>; total: number | null; latest: number | null; peak: number | null; available: boolean };
type Summary = { readAt: string; region: string; window: string; summary: Record<string, number | null>; services: Service[]; metrics: Record<string, Metric>; errors: Array<{ service: string; message: string; code: string }> };
type Service = { id: string; name: string; type: string; icon: string; state: string; endpoint?: string; items?: number; sizeBytes?: number; metrics: Record<string, Metric | undefined> };
type Node = { id: string; label: string; service: string; icon: string; layer: string; kind: string; status: string; source: string; detail?: string; file?: string; resourceName?: string; runtime?: string; timeout?: number; memory?: number };
type Edge = { id: string; source: string; target: string; label: string };
type Graph = { available: boolean; source: string; readAt?: string; region?: string; nodes: Node[]; edges: Edge[]; errors?: Array<{ service: string; message: string }> };
type ActivityData = { runs: Array<{ id: string; name: string; workflow: string; status: string; startedAt: string | null; endedAt: string | null; durationSeconds: number | null }>; errors?: Array<{ service: string; message: string }> };
type Costs = { available: boolean; total?: number; currency?: string; attribution?: string; services?: Array<{ name: string; amount: number; unit: string }>; daily?: Array<{ start: string; amount: number }> ; message?: string };
type Quotas = { available: boolean; region?: string; quotas: Array<{ name: string; value: number; unit?: string; adjustable: boolean }> };
type Security = { adminConsole: { authentication: string; browserSession: string; additionalSecretRequired: boolean }; apis: Array<{ name: string; endpoint: string; gatewayAuthentication: { protected: boolean; unprotectedRoutes: number; totalRoutes: number }; corsOrigins: string[] }>; notes: string[] };
type Tab = 'Vue d’ensemble' | 'Architecture' | 'Activité' | 'Services' | 'Coûts & quotas' | 'Sécurité' | 'Garde-fous' | 'Vocabulaire vocal' | 'Sources autorisées';
const tabs: Array<{ name: Tab; icon: typeof Activity }> = [
  { name: 'Vue d’ensemble', icon: Gauge }, { name: 'Architecture', icon: Workflow }, { name: 'Activité', icon: Activity },
  { name: 'Services', icon: Boxes }, { name: 'Coûts & quotas', icon: DollarSign }, { name: 'Sécurité', icon: ShieldCheck }, { name: 'Garde-fous', icon: ShieldAlert }, { name: 'Vocabulaire vocal', icon: BookOpen }, { name: 'Sources autorisées', icon: Globe2 },
];
const awsIcons: Record<string, string> = { 'api-gateway': 'Arch_Amazon-API-Gateway_48.svg', lambda: 'Arch_AWS-Lambda_48.svg', dynamodb: 'Arch_Amazon-DynamoDB_48.svg', s3: 'Arch_Amazon-Simple-Storage-Service_48.svg', 'step-functions': 'Arch_AWS-Step-Functions_48.svg', cloudwatch: 'Arch_Amazon-CloudWatch_48.svg', bedrock: 'Arch_Amazon-Bedrock_48.svg', cloudfront: 'Arch_Amazon-CloudFront_48.svg', 'secrets-manager': 'Arch_AWS-Secrets-Manager_48.svg', ecs: 'Arch_Amazon-Elastic-Container-Service_48.svg', elb: 'Arch_Elastic-Load-Balancing_48.svg' };
const base = import.meta.env.DEV && import.meta.env.VITE_API_TARGET
  ? '/api'
  : import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') || (import.meta.env.DEV ? '/profile-api' : '');
function awsIcon(icon: string) { return awsIcons[icon] ? `/aws-icons/${awsIcons[icon]}` : null; }
function display(value: number | null | undefined, suffix = '') { return value == null || !Number.isFinite(value) ? '—' : `${new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 1 }).format(value)}${suffix}`; }
function dateTime(value?: string | null) { return value ? new Date(value).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; }

export function AdminPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('Vue d’ensemble');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [costs, setCosts] = useState<Costs | null>(null);
  const [quotas, setQuotas] = useState<Quotas | null>(null);
  const [security, setSecurity] = useState<Security | null>(null);
  const [vocabulary, setVocabulary] = useState<VoiceVocabulary | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const request = useCallback(async <T,>(path: string, signal?: AbortSignal, init: RequestInit = {}): Promise<T> => {
    const response = await authenticatedFetch(`${base}/v1/admin/${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
      signal: init.signal ?? signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.detail || 'La console Admin est momentanément indisponible.');
    return payload as T;
  }, []);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('');
    try {
      const data = await request<Summary>('summary', signal);
      setSummary(data); setLastUpdated(data.readAt);
    } catch (reason) { if (!signal?.aborted) setError(reason instanceof Error ? reason.message : 'Erreur de connexion.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [request]);

  useEffect(() => { const controller = new AbortController(); void refresh(controller.signal); const timer = window.setInterval(() => void refresh(), 30_000); return () => { controller.abort(); window.clearInterval(timer); }; }, [refresh]);
  useEffect(() => { document.title = `${tab} · Admin · InvestorOS`; }, [tab]);
  useEffect(() => {
    if (tab !== 'Activité' && tab !== 'Coûts & quotas' && tab !== 'Sécurité' && tab !== 'Vocabulaire vocal') return;
    const controller = new AbortController();
    if (tab === 'Activité') void request<ActivityData>('activity', controller.signal).then(setActivity).catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    if (tab === 'Coûts & quotas') { void request<Costs>('costs', controller.signal).then(setCosts).catch((reason) => { if (!controller.signal.aborted) setError(reason.message); }); void request<Quotas>('quotas', controller.signal).then(setQuotas).catch((reason) => { if (!controller.signal.aborted) setError(reason.message); }); }
    if (tab === 'Sécurité') void request<Security>('security', controller.signal).then(setSecurity).catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    if (tab === 'Vocabulaire vocal') {
      const loadVocabulary = () => void request<VoiceVocabulary>('voice-vocabulary', controller.signal).then(setVocabulary).catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
      loadVocabulary();
      const timer = vocabulary?.state === 'PENDING' ? window.setInterval(loadVocabulary, 2500) : undefined;
      return () => { controller.abort(); if (timer) window.clearInterval(timer); };
    }
    return () => controller.abort();
  }, [request, tab, vocabulary?.state]);

  const logout = async () => { await signOut(); navigate('/login', { replace: true }); };
  const moveTab = (event: React.KeyboardEvent, index: number) => { if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return; event.preventDefault(); const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; setTab(tabs[next].name); tabRefs.current[next]?.focus(); };
  const saveVocabulary = async (phrases: string[]) => {
    const response = await authenticatedFetch(`${base}/v1/admin/voice-vocabulary`, { method: 'PUT', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ phrases }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.detail || 'La mise à jour du vocabulaire AWS a échoué.');
    setVocabulary(payload as VoiceVocabulary);
  };

  return <div className={`admin-page${tab === 'Architecture' ? ' is-architecture' : tab === 'Activité' ? ' is-activity' : ''}`}>
    <header className="admin-header"><div><div className="admin-eyebrow">CENTRE DE CONTRÔLE · {summary?.region ?? 'AWS'}</div><h1>Administration</h1><p>État de la plateforme et ressources d’infrastructure en direct.</p></div><div className="admin-header-actions"><span className="admin-updated">Actualisé {dateTime(lastUpdated)}</span><button className="admin-icon-button" onClick={() => void refresh()} aria-label="Actualiser les données" title="Actualiser"><RefreshCw size={16} className={loading ? 'is-spinning' : ''} /></button><button className="admin-icon-button" onClick={logout} aria-label="Fermer la session Admin" title="Fermer la session"><LogOut size={16} /></button></div></header>
    <nav className="admin-tabs" role="tablist" aria-label="Sections Admin">{tabs.map(({ name, icon: Icon }, index) => <button ref={(element) => { tabRefs.current[index] = element; }} key={name} role="tab" id={`admin-tab-${index}`} aria-selected={tab === name} aria-controls="admin-panel" tabIndex={tab === name ? 0 : -1} onClick={() => setTab(name)} onKeyDown={(event) => moveTab(event, index)}><Icon size={16} />{name}</button>)}</nav>
    {error && <div className="admin-notice" role="status"><AlertTriangle size={16} />{error}<button onClick={() => setError('')} aria-label="Fermer"><X size={15} /></button></div>}
    <section className="admin-panel" id="admin-panel" role="tabpanel" aria-labelledby={`admin-tab-${tabs.findIndex((item) => item.name === tab)}`} key={tab}>
      {tab === 'Vue d’ensemble' && <Overview summary={summary} loading={loading} onArchitecture={() => setTab('Architecture')} />}
      {tab === 'Architecture' && <Architecture request={request} onExit={() => setTab('Vue d’ensemble')} />}
      {tab === 'Activité' && <ActivityPanel data={activity} />}
      {tab === 'Services' && <Services services={summary?.services ?? []} />}
      {tab === 'Coûts & quotas' && <CostsPanel costs={costs} quotas={quotas} />}
      {tab === 'Sécurité' && <SecurityPanel data={security} />}
      {tab === 'Garde-fous' && <GuardrailsPanel request={request} />}
      {tab === 'Vocabulaire vocal' && <VoiceVocabularyPanel vocabulary={vocabulary} onSave={saveVocabulary} onError={setError} />}
      {tab === 'Sources autorisées' && <SourceExplorer />}
    </section>
  </div>;
}

function Overview({ summary, loading, onArchitecture }: { summary: Summary | null; loading: boolean; onArchitecture: () => void }) {
  const values = summary?.summary;
  const metrics = [{ label: 'Requêtes API · 1 h', value: values?.apiRequests, icon: Activity, color: 'blue' }, { label: 'Erreurs API · 1 h', value: values?.apiErrors, icon: AlertTriangle, color: 'rose' }, { label: 'Taux d’erreur API', value: values?.apiErrorRate, suffix: ' %', icon: ArrowUpRight, color: 'rose' }, { label: 'Latence API p95 · max 1 h', value: values?.apiP95LatencyMs, suffix: ' ms', icon: Gauge, color: 'blue' }, { label: 'Invocations Lambda · 1 h', value: values?.lambdaInvocations, icon: Boxes, color: 'teal' }, { label: 'Analyses échouées · 1 h', value: values?.failedAnalyses, icon: Workflow, color: 'amber' }, { label: 'Tokens Bedrock · 1 h', value: values?.bedrockTokens, icon: Activity, color: 'teal' }];
  const apiMetric = summary?.services.find((service) => service.type === 'API Gateway')?.metrics?.['Count'];
  const points = apiMetric?.points ?? [];
  return <div className="admin-overview"><div className="admin-section-heading"><div><h2>Performance globale</h2><p>{summary?.window ?? 'Lecture CloudWatch en attente'} · Actualisation automatique chaque 30 s</p></div><button className="admin-text-button" onClick={onArchitecture}>Explorer l’architecture <ChevronRight size={15} /></button></div>
    <div className="admin-kpi-grid">{metrics.map(({ label, value, suffix, icon: Icon, color }) => <article className="admin-kpi-card" key={label}><span className={`admin-kpi-icon ${color}`}><Icon size={17} /></span><span className="admin-kpi-label">{label}</span><strong>{summary ? display(value, value == null ? '' : suffix) : loading ? '…' : '—'}</strong><small>{value == null && summary ? 'Aucune donnée CloudWatch' : 'Données AWS réelles'}</small></article>)}</div>
    <div className="admin-overview-grid"><article className="admin-card admin-chart-card"><div className="admin-card-heading"><div><h3>Trafic API</h3><p>Requêtes observées par minute · dernière heure</p></div><span className="admin-chart-total">{display(values?.apiRequests)}</span></div><MetricChart points={points} color="#356CE0" /><div className="admin-chart-footer"><span><i className="chart-key blue" />Requêtes</span><span>{points.length ? `${points.length} points CloudWatch` : 'Aucune donnée disponible pour cette période'}</span></div></article>
      <article className="admin-card admin-health-card"><div className="admin-card-heading"><div><h3>Santé des services</h3><p>Inventaire détecté dans AWS</p></div><span className="admin-count-pill">{summary?.services.length ?? '—'} services</span></div><div className="admin-health-list">{(summary?.services.slice(0, 5) ?? []).map((service) => <div className="admin-health-row" key={service.id}><AWSIcon name={service.icon} /><span><strong>{service.name}</strong><small>{service.type}</small></span><span className="admin-state"><i />{service.state}</span></div>)}{!summary?.services.length && <Empty message={loading ? 'Chargement de l’inventaire AWS…' : 'Inventaire non disponible'} />}</div><button className="admin-text-button" onClick={onArchitecture}>{summary?.summary.resourceCount ?? 0} ressources répertoriées <ChevronRight size={15} /></button></article></div>
    {summary?.errors.map((item) => <div className="admin-error-row" key={`${item.service}-${item.code}`}><CircleHelp size={15} />{item.service} : {item.message} <span>{item.code}</span></div>)}
  </div>;
}
function MetricChart({ points, color }: { points: Array<{ at: string; value: number }>; color: string }) { const w = 720, h = 200, pad = 12; const max = Math.max(1, ...points.map((p) => p.value)); const coords = points.map((p, i) => `${pad + i * ((w - pad * 2) / Math.max(1, points.length - 1))},${h - pad - (p.value / max) * (h - pad * 2)}`).join(' '); return <div className="admin-chart"><svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Graphique du nombre de requêtes API par minute"><defs><linearGradient id="admin-chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".19" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>{[.25,.5,.75,1].map((step) => <line key={step} x1="0" x2={w} y1={h * step} y2={h * step} stroke="#edf1f6" strokeDasharray="3 5" />)}{points.length > 1 && <><polygon points={`${pad},${h - pad} ${coords} ${w - pad},${h - pad}`} fill="url(#admin-chart-fill)" /><polyline points={coords} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" /></>}{points.length === 1 && <circle cx={w / 2} cy={h / 2} r="5" fill={color} />}</svg></div>; }
function AWSIcon({ name, className = '' }: { name: string; className?: string }) { const icon = awsIcon(name); return icon ? <img className={`admin-aws-icon ${className}`} src={icon} alt="" loading="lazy" /> : <span className={`admin-fallback-icon ${className}`}><Cloud size={18} /></span>; }
function Empty({ message }: { message: string }) { return <div className="admin-empty"><CircleHelp size={17} />{message}</div>; }

function Architecture({ request, onExit }: { request: <T,>(path: string, signal?: AbortSignal) => Promise<T>; onExit: () => void }) {
  const [mode, setMode] = useState<'live' | 'terraform'>('live');
  const [graph, setGraph] = useState<Graph | null>(null);
  const [selected, setSelected] = useState('');
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: 'node' | 'pan'; id?: string; x: number; y: number } | null>(null);
  const positions = useRef<Record<string, { x: number; y: number }>>({});
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    request<Graph>(`architecture?mode=${mode}`, controller.signal)
      .then((data) => {
        setGraph(data);
        setSelected('');
        setInspectorOpen(false);
        positions.current = {};
        setPan({ x: 0, y: 0 });
        setZoom(1);
      })
      .catch(() => setGraph(null))
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [mode, request]);

  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];
  const visibleNodes = nodes.filter((node) => `${node.label} ${node.service} ${node.kind}`.toLowerCase().includes(query.toLowerCase()));
  const placed = useMemo(() => {
    const columns: Record<string, number> = {};
    const map: Record<string, { x: number; y: number }> = {};
    const laneX: Record<string, number> = { entry: 70, network: 70, compute: 380, orchestration: 690, ai: 990, data: 990, security: 990, operations: 690 };
    nodes.forEach((node) => {
      if (positions.current[node.id]) { map[node.id] = positions.current[node.id]; return; }
      const layer = node.layer || 'compute';
      const column = columns[layer] ?? 0;
      columns[layer] = column + 1;
      map[node.id] = { x: laneX[layer] ?? 380, y: 70 + column * 135 };
    });
    return map;
  }, [nodes, revision]);
  const selectedNode = nodes.find((node) => node.id === selected);
  const linked = edges.filter((edge) => edge.source === selected || edge.target === selected);
  const extent = Math.max(700, ...Object.values(placed).map((point) => point.y + 120));

  const wheel = (event: React.WheelEvent) => {
    if ((event.target as HTMLElement).closest('.arch-inspector,.arch-canvas-toolbar')) return;
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const nextZoom = Math.min(1.8, Math.max(.3, zoom * (event.deltaY > 0 ? .92 : 1.08)));
      const bounds = canvasRef.current?.getBoundingClientRect();
      if (bounds) {
        const localX = event.clientX - bounds.left;
        const localY = event.clientY - bounds.top;
        const worldX = (localX - pan.x) / zoom;
        const worldY = (localY - pan.y) / zoom;
        setPan({ x: localX - worldX * nextZoom, y: localY - worldY * nextZoom });
      }
      setZoom(nextZoom);
      return;
    }
    // Trackpad and wheel pan without a finite scroll container or edge limit.
    setPan((current) => ({ x: current.x - event.deltaX, y: current.y - event.deltaY }));
  };
  const startNode = (event: React.PointerEvent, node: Node) => {
    event.preventDefault();
    event.stopPropagation();
    drag.current = { kind: 'node', id: node.id, x: event.clientX, y: event.clientY };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };
  const move = (event: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = (event.clientX - drag.current.x) / zoom;
    const dy = (event.clientY - drag.current.y) / zoom;
    if (drag.current.kind === 'node' && drag.current.id) {
      const old = positions.current[drag.current.id] ?? placed[drag.current.id];
      if (old) positions.current = { ...positions.current, [drag.current.id]: { x: old.x + dx, y: old.y + dy } };
      setRevision((value) => value + 1);
    } else {
      setPan((current) => ({ x: current.x + dx, y: current.y + dy }));
    }
    drag.current.x = event.clientX;
    drag.current.y = event.clientY;
  };
  const startPan = (event: React.PointerEvent) => {
    if ((event.target as HTMLElement).closest('.arch-node,.arch-controls,.arch-canvas-toolbar,.arch-inspector')) return;
    drag.current = { kind: 'pan', x: event.clientX, y: event.clientY };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };
  const fit = () => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds || !Object.keys(placed).length) { setPan({ x: 24, y: 30 }); setZoom(1); return; }
    const points = Object.values(placed);
    const minX = Math.min(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxX = Math.max(...points.map((point) => point.x + 190));
    const maxY = Math.max(...points.map((point) => point.y + 85));
    const nextZoom = Math.min(1.25, Math.max(.3, Math.min((bounds.width - 64) / (maxX - minX), (bounds.height - 100) / (maxY - minY))));
    setZoom(nextZoom);
    setPan({ x: (bounds.width - (maxX - minX) * nextZoom) / 2 - minX * nextZoom, y: (bounds.height - (maxY - minY) * nextZoom) / 2 - minY * nextZoom });
  };

  return <div className="admin-architecture">
    <div className="arch-workspace">
      <div className="arch-canvas" ref={canvasRef} onWheel={wheel} onPointerDown={startPan} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <div className="arch-canvas-toolbar">
          <label className="arch-search"><Search size={15} /><input aria-label="Rechercher une ressource" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une ressource…" /></label>
          <div className="arch-toolbar-right">
            <div className="arch-mode-switch" role="group" aria-label="Source de l’architecture"><button className={mode === 'live' ? 'active' : ''} onClick={() => setMode('live')}>AWS en direct</button><button className={mode === 'terraform' ? 'active' : ''} onClick={() => setMode('terraform')}>Terraform</button></div>
            <div className="arch-controls"><button title="Dézoomer" aria-label="Dézoomer" onClick={() => setZoom((value) => Math.max(.3, value - .1))}><Minus size={15} /></button><span>{Math.round(zoom * 100)}%</span><button title="Zoomer" aria-label="Zoomer" onClick={() => setZoom((value) => Math.min(1.8, value + .1))}><Plus size={15} /></button><button title="Cadrer les ressources" aria-label="Cadrer les ressources" onClick={fit}><Maximize size={15} /></button></div>
            <button className="arch-exit" onClick={onExit} aria-label="Retour aux onglets Admin"><X size={15} /><span>Retour Admin</span></button>
          </div>
        </div>
        {busy ? <div className="arch-loading"><RefreshCw className="is-spinning" size={20} />Lecture de l’architecture…</div> : !graph?.available ? <div className="arch-loading"><CircleHelp size={18} />Impossible de charger l’architecture avec les permissions AWS actuelles.</div> : <div className="arch-world"><div className="arch-world-transform" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, width: 1280, height: extent }}>
          <div className="arch-lanes">{[['entry','Entrée'],['compute','Calcul'],['orchestration','Orchestration'],['data','Données · IA · opérations']].map(([id,label]) => <div key={id} className={`arch-lane lane-${id}`}><span>{label}</span></div>)}</div>
          <svg className="arch-edge-layer" width="1280" height={extent} aria-label="Connexions entre les services"><defs><marker id="arch-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#91a5bd" /></marker></defs>{edges.map((edge) => { const source = placed[edge.source], target = placed[edge.target]; if (!source || !target || !visibleNodes.some((node) => node.id === edge.source) || !visibleNodes.some((node) => node.id === edge.target)) return null; const x1 = source.x + 190, y1 = source.y + 42, x2 = target.x, y2 = target.y + 42; const path = `M ${x1} ${y1} C ${x1 + 90} ${y1}, ${x2 - 90} ${y2}, ${x2} ${y2}`; return <g key={edge.id} className={`arch-edge ${selected === edge.source || selected === edge.target ? 'is-related' : ''}`}><path d={path} /><text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 7}>{edge.label}</text></g>; })}</svg>
          {visibleNodes.map((node) => { const point = placed[node.id]; return <button type="button" key={node.id} className={`arch-node ${selected === node.id ? 'is-selected' : ''}`} style={{ left: point.x, top: point.y }} onPointerDown={(event) => startNode(event, node)} onClick={() => { setSelected(node.id); setInspectorOpen(true); }}><span className="arch-node-icon"><AWSIcon name={node.icon} /></span><span className="arch-node-copy"><strong>{node.label}</strong><small>{node.service}</small></span><span className={`arch-node-status ${node.source}`}>{node.status}</span></button>; })}
        </div></div>}
        <div className="arch-legend"><span><i className="aws-legend" />Ressource AWS</span><span><i className="tf-legend" />Déclaration Terraform</span><span>{nodes.length} éléments · {edges.length} liens</span><small>Glisser pour déplacer · Molette pour naviguer · Ctrl + molette pour zoomer</small></div>
        {inspectorOpen && selectedNode && <aside className="arch-inspector" aria-label={`Détails de ${selectedNode.label}`}><div className="arch-inspector-title"><div><span className="admin-eyebrow">INSPECTEUR</span><h3>{selectedNode.label}</h3></div><button className="admin-icon-button" onClick={() => setInspectorOpen(false)} aria-label="Fermer les détails"><X size={16} /></button></div><span className={`arch-source-pill ${mode}`}>{mode === 'live' ? 'AWS en direct' : 'Terraform'}</span><div className="arch-inspector-service"><AWSIcon name={selectedNode.icon} /><div><strong>{selectedNode.service}</strong><span>{selectedNode.kind} · {selectedNode.status}</span></div></div><dl className="arch-details">{selectedNode.resourceName && <><dt>Nom AWS</dt><dd>{selectedNode.resourceName}</dd></>}{selectedNode.runtime && <><dt>Runtime</dt><dd>{selectedNode.runtime} · {selectedNode.memory} MB · {selectedNode.timeout}s</dd></>}{selectedNode.file && <><dt>Déclaré dans</dt><dd>{selectedNode.file}</dd></>}{selectedNode.detail && <><dt>Détail</dt><dd>{selectedNode.detail}</dd></>}{graph?.readAt && <><dt>Lecture</dt><dd>{dateTime(graph.readAt)}</dd></>}</dl><div className="arch-connections"><h4>Connexions <span>{linked.length}</span></h4>{linked.length ? linked.map((edge) => { const other = nodes.find((node) => node.id === (edge.source === selected ? edge.target : edge.source)); return <button key={edge.id} onClick={() => setSelected(other?.id ?? '')}><span className="arch-connection-dot" /><span><strong>{other?.label}</strong><small>{edge.label}</small></span><ChevronRight size={15} /></button>; }) : <Empty message="Aucune connexion détectée dans cette source." />}</div>{graph?.errors?.map((item) => <div className="admin-error-row" key={item.service}>{item.service} : {item.message}</div>)}</aside>}
      </div>
    </div>
  </div>;
}
function ActivityPanel({ data }: { data: ActivityData | null }) { return <div className="admin-content-panel"><div className="admin-section-heading"><div><h2>Activité de la plateforme</h2><p>Exécutions récentes des workflows AWS Step Functions.</p></div><span className="admin-count-pill">{data?.runs.length ?? '—'} exécutions</span></div><div className="admin-card admin-table-card"><div className="admin-table-wrap"><table><thead><tr><th>Workflow</th><th>État</th><th>Démarrée</th><th>Durée</th><th>Identifiant</th></tr></thead><tbody>{data?.runs.map((run) => <tr key={run.id}><td><strong>{run.workflow}</strong><small>{run.name}</small></td><td><span className={`run-status ${run.status.toLowerCase()}`}>{run.status}</span></td><td>{dateTime(run.startedAt)}</td><td>{run.durationSeconds == null ? '—' : `${display(run.durationSeconds)} s`}</td><td className="run-id" title={run.id}>{run.id.slice(-18)}</td></tr>)}</tbody></table>{data && !data.runs.length && <Empty message="Aucune exécution récente retournée par Step Functions." />}{!data && <Empty message="Chargement des exécutions…" />}</div></div>{data?.errors?.map((item) => <div className="admin-error-row" key={item.service}>{item.message}</div>)}</div>; }
function ServiceSparkline({ metric, label }: { metric?: Metric; label: string }) {
  const points = metric?.points ?? [];
  if (points.length < 2) return null;
  const width = 150;
  const height = 22;
  const low = Math.min(...points.map((point) => point.value));
  const range = Math.max(1, ...points.map((point) => point.value)) - low || 1;
  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - 2 - ((point.value - low) / range) * (height - 5);
    return `${x},${y}`;
  }).join(' ');
  return <svg className="service-sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Tendance CloudWatch : ${label}`}><polyline points={coords} /><title>{label} · {points.length} points CloudWatch</title></svg>;
}

function Services({ services }: { services: Service[] }) {
  const [filter, setFilter] = useState('');
  const rows = services.filter((service) => `${service.name} ${service.type}`.toLowerCase().includes(filter.toLowerCase()));
  const labels: Record<string, string> = { Count: 'Requêtes', '4XXError': '4xx', '5XXError': '5xx', Latency: 'Latence p95', IntegrationLatency: 'Intégration p95', Invocations: 'Invocations', Errors: 'Erreurs', Throttles: 'Limites', Duration: 'Durée moy.', ExecutionsStarted: 'Démarrées', ExecutionsSucceeded: 'Réussies', ExecutionsFailed: 'Échouées', ExecutionsTimedOut: 'Expirées', ReadThrottleEvents: 'Blocages lecture', WriteThrottleEvents: 'Blocages écriture', InputTokenCount: 'Tokens entrants', OutputTokenCount: 'Tokens sortants' };
  return <div className="admin-content-panel">
    <div className="admin-section-heading"><div><h2>Services AWS</h2><p>État des ressources découvertes et leurs dernières métriques CloudWatch.</p></div><label className="arch-search"><Search size={15} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filtrer les services…" /></label></div>
    <div className="service-grid">{rows.map((service) => <article className="admin-card service-card" key={service.id}>
      <div className="service-title"><AWSIcon name={service.icon} /><div><strong>{service.name}</strong><small>{service.type}</small></div><span className="admin-state"><i />{service.state}</span></div>
      {service.endpoint && <a className="service-endpoint" href={service.endpoint} target="_blank" rel="noreferrer">Point de terminaison <ExternalLink size={12} /></a>}
      {service.items != null && <p className="service-meta">{display(service.items)} éléments · {service.sizeBytes ? `${display(service.sizeBytes / 1024)} Ko` : 'taille non publiée'}</p>}
      <div className="service-metrics">{Object.entries(service.metrics).map(([key, metric]) => {
        const label = labels[key] ?? key;
        const duration = key.includes('Latency') || key === 'Duration';
        const value = duration ? metric?.latest : metric?.total;
        return <div key={key}><span>{label}</span><strong>{display(value, duration ? ' ms' : '')}</strong><ServiceSparkline metric={metric} label={label} /></div>;
      })}</div>
    </article>)}{!rows.length && <Empty message={services.length ? 'Aucun service ne correspond à ce filtre.' : 'Aucun service n’a été retourné par AWS.'} />}</div>
  </div>;
}
function CostsPanel({ costs, quotas }: { costs: Costs | null; quotas: Quotas | null }) { const max = Math.max(1, ...(costs?.services ?? []).map((item) => item.amount)); return <div className="admin-content-panel"><div className="admin-section-heading"><div><h2>Coûts et quotas</h2><p>Cost Explorer et Service Quotas Amazon Bedrock.</p></div></div><div className="costs-grid"><article className="admin-card cost-card"><div className="admin-card-heading"><div><h3>Coûts AWS du mois</h3><p>Regroupement par service · {costs?.currency ?? 'USD'}</p></div><span className="admin-kpi-icon amber"><DollarSign size={17} /></span></div>{costs?.available ? <><strong className="cost-total">{new Intl.NumberFormat('fr-CA',{style:'currency',currency:costs.currency || 'USD'}).format(costs.total ?? 0)}</strong><div className="cost-bars">{costs.services?.slice(0,8).map((item) => <div className="cost-bar-row" key={item.name}><span>{item.name}</span><i><b style={{ width: `${Math.max(2,item.amount/max*100)}%` }} /></i><strong>{item.amount.toFixed(2)} {item.unit}</strong></div>)}</div><p className="cost-attribution"><CircleHelp size={14} />{costs.attribution}</p></> : <Empty message={costs?.message ?? 'Chargement des données Cost Explorer…'} />}</article><article className="admin-card quota-card"><div className="admin-card-heading"><div><h3>Quotas Amazon Bedrock</h3><p>Limites configurées dans {quotas?.region ?? 'la région AWS'}.</p></div><span className="admin-kpi-icon teal"><Gauge size={17} /></span></div>{quotas?.quotas.length ? <div className="quota-list">{quotas.quotas.map((item) => <div key={item.name}><span>{item.name}</span><strong>{display(item.value)} {item.unit}</strong>{item.adjustable && <small>Modifiable</small>}</div>)}</div> : <Empty message={quotas ? 'Aucun quota Bedrock pertinent retourné ou permission manquante.' : 'Chargement des quotas…'} />}</article></div></div>; }
function SecurityPanel({ data }: { data: Security | null }) { return <div className="admin-content-panel"><div className="admin-section-heading"><div><h2>Sécurité et accès</h2><p>Contrôles observables et mode de protection de la console.</p></div></div><div className="security-grid"><article className="admin-card security-card"><div className="security-card-title"><ShieldCheck size={19} /><h3>Console Admin</h3></div><div className="security-item"><span>Authentification</span><strong>{data?.adminConsole.authentication ?? '…'}</strong></div><div className="security-item"><span>Session navigateur</span><strong>{data?.adminConsole.browserSession ?? '…'}</strong></div><div className="security-item"><span>Jeton séparé requis</span><strong>{data ? (data.adminConsole.additionalSecretRequired ? 'Oui' : 'Non') : '…'}</strong></div></article><article className="admin-card security-card"><div className="security-card-title"><Cloud size={19} /><h3>API Gateway</h3></div>{data?.apis.map((api) => <div className="api-security-row" key={api.name}><strong>{api.name}</strong><span className={api.gatewayAuthentication.protected ? 'security-good' : 'security-warn'}>{api.gatewayAuthentication.protected ? <Check size={14} /> : <AlertTriangle size={14} />}{api.gatewayAuthentication.unprotectedRoutes} / {api.gatewayAuthentication.totalRoutes} routes sans authorizer Gateway</span><small>Origines CORS : {api.corsOrigins.join(', ') || 'non publiées'}</small></div>)}{!data?.apis.length && <Empty message="Chargement de la configuration API…" />}</article></div><div className="admin-security-note"><ShieldCheck size={16} /><span>API Gateway valide le JWT Cognito et le backend vérifie le groupe <code>administrators</code>. Les routes historiques publiques sont recensées séparément; aucun jeton Admin distinct n’est transmis.</span></div>{data?.notes.map((note) => <p className="security-note" key={note}>{note}</p>)}</div>; }
