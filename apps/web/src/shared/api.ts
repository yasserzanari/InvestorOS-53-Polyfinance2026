import { authenticatedFetch } from './auth';
export type DemoOverview = {
  mode: 'demo';
  source: 'aws-dynamodb';
  persona: 'amira' | 'mateo' | 'robert';
  account: {
    display_name: string;
    is_demo: true;
    financial_linked: false;
  };
  profile: {
    display_name: string;
    is_demo: true;
    status: string;
  };
  portfolio: {
    display_name: string;
    is_demo: true;
    currency: string;
    total_value: number;
    positions: Array<{ id: string; label: string; weight_pct: number; value: number; ticker?: string }>;
  };
  analyses: Array<Record<string, unknown>>;
};

export type PortfolioWatchItem = {
  persona: DemoOverview['persona']; positionId: string; positionLabel: string;
  ticker: string; company: string; addedAt: string;
};
export type PortfolioNewsCase = {
  id: string; persona: DemoOverview['persona']; status: 'new' | 'read' | 'resolved';
  ticker: string; company: string; positionId: string; positionLabel: string;
  title: string; summary: string; eventType: string; nextAction: string;
  evidenceQuote: string; source: { domain: string; url: string; indexedAt: string; classification: string };
  createdAt: string; limitations: string[];
};
export type PortfolioMonitorScan = {
  id: string; persona: DemoOverview['persona']; status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string; updatedAt: string; completedAt?: string; message?: string;
  result?: { checkedArticles: number; newCases: number };
};

export type DemoApiConnection =
  | { status: 'not_configured' }
  | { status: 'connected'; overview: DemoOverview }
  | { status: 'rate_limited' }
  | { status: 'unavailable' };

export type ResearchHistoryItem = {
  analysis_id: string;
  persona: 'amira' | 'mateo' | 'robert';
  question: string;
  status: string;
  created_at?: string;
  completed_at?: string;
  error?: string;
};

export async function loadResearchHistory(persona: ResearchHistoryItem['persona'], signal?: AbortSignal): Promise<ResearchHistoryItem[]> {
  const base = getApiBase() ?? (import.meta.env.DEV ? '/profile-api' : null);
  if (!base) throw new Error('La connexion au moteur de recherche n’est pas configurée.');
  const response = await authenticatedFetch(`${base}/v1/profiles/research/analyses?accountId=${encodeURIComponent(persona)}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    let message = 'L’historique de recherche est indisponible.';
    try {
      const body = await response.json() as { detail?: string };
      if (typeof body.detail === 'string') message = body.detail;
    } catch { /* Keep the stable local error. */ }
    throw new Error(message);
  }
  const payload = await response.json() as { analyses?: ResearchHistoryItem[] };
  if (!Array.isArray(payload.analyses)) throw new Error('Le moteur a renvoyé un historique invalide.');
  return payload.analyses;
}

export type PortfolioScenarioShock = { positionId: string; shockPct: number };
export type PortfolioScenarioImpact = {
  name: string;
  persona: 'amira' | 'mateo' | 'robert';
  currency: string;
  baselineValue: number;
  scenarioValue: number;
  changeValue: number;
  changePct: number;
  positions: Array<{
    positionId: string;
    label: string;
    baselineValue: number;
    shockPct: number;
    changeValue: number;
    scenarioValue: number;
  }>;
  provenance: { portfolio: string; assumptions: string; limitations: string[]; moduleUrl: string };
};

export type SimulationAsset = {
  asset_id: string;
  ticker: string;
  name: string;
  asset_class: string;
  market: string;
  currency: string;
  sector: string;
};
export type SimulationAssetList = { assets: SimulationAsset[]; source: string; sourceAsOf: string; limitations: string[] };
export type SimulationHistory = {
  asset: SimulationAsset;
  prices: Array<{ date: string; adjustedClose: number; volume: number }>;
  events: Array<{ id: string; date: string; kind: string; value: number | null; unit: string | null; observedPriceDate: string | null; observedReturnsPct: Record<string, number | null> }>;
  currency: string;
  source: string;
  sourceAsOf: string;
  sourceClassification?: 'illustrative' | 'observations' | 'unknown';
  sourceDescription?: string;
  sourceUrl?: string;
  method: string;
  limitations: string[];
};
export type MarketMovementCandidate = {
  id: string; title: string; url: string; sourceName: string; sourceId: string; evidenceId: string;
  publishedAt: string; publicationPrecision: 'timestamp' | 'date'; timing: 'interval' | 'date_only';
  excerpt: string; charactersRead: number; category: 'governance' | 'earnings' | 'regulation' | 'other';
};
export type MarketMovement = {
  id: string; date: string; previousDate: string; price: number; previousPrice: number; changePct: number;
  direction: 'up' | 'down'; status: 'context_found' | 'unexplained'; explanation: string; candidates: MarketMovementCandidate[];
};
export type MarketMovementReport = {
  analysisId: string; ticker: string; asOf: string; currency: string; thresholdPct: number;
  window: { start: string; end: string }; source: { title: string; url?: string; classification?: string };
  totalMoves: number; movements: MarketMovement[]; evidenceCoverage: { documentsRead: number; indexedLeadsExcluded: number };
  method: string; limitations: string[];
  collection?: { status: 'complete' | 'partial' | 'unavailable' | 'unsupported' | 'disabled' | 'not_requested'; documentsRead: number; sourceName: string; checkedAt?: string; message: string };
};
export type SimulationEventStudy = {
  ticker: string;
  benchmarkTicker: string | null;
  eventDate: string;
  sourceAsOf: string;
  source: string;
  method: string;
  limitations: string[];
  points: Array<{
    horizonObservations: 1 | 5 | 20;
    stockStartDate: string | null;
    stockEndDate: string | null;
    stockReturnPct: number | null;
    benchmarkStartDate: string | null;
    benchmarkEndDate: string | null;
    benchmarkReturnPct: number | null;
    excessReturnPct: number | null;
  }>;
};
export type SimulationRegulation = {
  id: string;
  title: string;
  type: string;
  publishedAt: string;
  effectiveOn: string | null;
  summary: string;
  agencies: string[];
  url: string;
  officialPdfUrl: string | null;
};
export type SimulationRegulations = {
  topic: string;
  query: string;
  page: number;
  startDate: string;
  endDate: string;
  totalDocuments: number | null;
  totalPages: number | null;
  pageLimit: number;
  source: string;
  sourceUrl: string;
  legalStatus: string;
  documents: SimulationRegulation[];
};
export type SimulationFiling = {
  id: string;
  form: string;
  filedAt: string;
  reportedAt: string | null;
  acceptedAt: string | null;
  title: string;
  url: string;
  accessionNumber: string;
};
export type SimulationFilings = {
  ticker: string;
  company?: string;
  cik?: string;
  available: boolean;
  reason?: string;
  source: string;
  sourceUrl: string;
  asOf?: string;
  startDate?: string;
  truncated?: boolean;
  filings: SimulationFiling[];
  limitations?: string[];
};
export type SimulationNewsArticle = {
  id: string;
  title: string;
  url: string;
  domain: string;
  indexedAt: string;
  imageUrl?: string;
};
export type SimulationNews = {
  ticker: string;
  company?: string;
  available: boolean;
  reason?: string;
  source: string;
  sourceUrl: string;
  asOf?: string;
  articles: SimulationNewsArticle[];
  limitations?: string[];
};
export type SimulationSocialPost = {
  id: string;
  text: string;
  url: string;
  author: string;
  username?: string;
  publishedAt: string;
  imageUrl?: string;
};
export type SimulationSocialPosts = {
  ticker: string;
  company?: string;
  accounts?: string[];
  available: boolean;
  reason?: string;
  source: string;
  sourceUrl: string;
  asOf?: string;
  posts: SimulationSocialPost[];
  limitations?: string[];
};
export type ScenarioBranchBase = { id: string; title: string; event: string; shockPct: number; sourceUrl?: string };
export type ObservationBranchInput = ScenarioBranchBase & { eventAfterObservations: number; eventAfterDays?: never };
export type CalendarBranchInput = ScenarioBranchBase & { eventAfterDays: number; eventAfterObservations?: never };
export type ScenarioBranchInput = ObservationBranchInput | CalendarBranchInput;
export type SimulationPricePoint = { eventApplied: boolean; lowerPrice: number; medianPrice: number; upperPrice: number };
export type ObservationPathPoint = SimulationPricePoint & { observations: number; days?: never };
export type CalendarPathPoint = SimulationPricePoint & { days: number; observations?: never };
export type SimulationPathPoint = ObservationPathPoint | CalendarPathPoint;
export type SimulationProjectionBase = {
  model?:string; dataSha256?:string; validation?:{trainingReturns:number;holdoutWindows:number;empiricalCoveragePct:number|null;horizonObservations:number};
  ticker: string; asOf: string; startingPrice: number; currency: string; source: string;
  sourceClassification?: 'illustrative' | 'observations' | 'unknown';
  sourceDescription?: string;
  provenance?: { sourceUrl?: string; moduleUrl?: string }; sourceUrl?: string;
  method: string; limitations: string[];
};
export type SimulationProjection = SimulationProjectionBase & (
  { timeUnit: 'calendar_days'; horizonDays: number; horizonObservations?: never; branches: Array<CalendarBranchInput & { path: CalendarPathPoint[] }> } |
  { timeUnit?: 'observations'; horizonObservations: number; horizonDays?: never; branches: Array<ObservationBranchInput & { path: ObservationPathPoint[] }> }
);
export type SimulationProjectionInput = { ticker: string } & (
  { horizonDays: number; horizonObservations?: never; branches: CalendarBranchInput[] } |
  { horizonObservations: number; horizonDays?: never; branches: ObservationBranchInput[] }
);
export const simulationPointOffset = (point: SimulationPathPoint): number => typeof point.days === 'number' ? point.days : point.observations!;
export const simulationEventOffset = (branch: ScenarioBranchInput): number => typeof branch.eventAfterDays === 'number' ? branch.eventAfterDays : branch.eventAfterObservations!;
export const simulationHorizon = (projection: SimulationProjection): number => projection.timeUnit === 'calendar_days' ? projection.horizonDays : projection.horizonObservations;
export const simulationTimeLabel = (projection: SimulationProjection, count?: number): string => projection.timeUnit === 'calendar_days' ? (count === 1 ? 'jour calendaire' : 'jours calendaires') : (count === 1 ? 'séance' : 'séances');

/** Validate tool/API results before graphing: units and offsets may never be interchanged. */
export function parseSimulationProjection(value: unknown): SimulationProjection | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Record<string, unknown>;
  const calendar = p.timeUnit === 'calendar_days';
  if (p.timeUnit !== undefined && p.timeUnit !== 'calendar_days' && p.timeUnit !== 'observations') return null;
  const horizon = calendar ? p.horizonDays : p.horizonObservations;
  const oppositeHorizon = calendar ? p.horizonObservations : p.horizonDays;
  const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  if (!finite(horizon) || !Number.isInteger(horizon) || horizon < 1 || horizon > 120 || oppositeHorizon !== undefined) return null;
  if (typeof p.ticker !== 'string' || !p.ticker || typeof p.asOf !== 'string' || !Number.isFinite(Date.parse(p.asOf)) || !finite(p.startingPrice) || p.startingPrice <= 0 || typeof p.currency !== 'string' || !/^[A-Z]{3}$/.test(p.currency) || typeof p.source !== 'string' || typeof p.method !== 'string' || !Array.isArray(p.limitations) || !p.limitations.every(item => typeof item === 'string')) return null;
  if (p.sourceDescription !== undefined && typeof p.sourceDescription !== 'string') return null;
  if (p.sourceClassification !== undefined && !['illustrative', 'observations', 'unknown'].includes(String(p.sourceClassification))) return null;
  if (!Array.isArray(p.branches) || p.branches.length < 1 || p.branches.length > 4) return null;
  const ids = new Set<string>();
  for (const raw of p.branches) {
    if (!raw || typeof raw !== 'object') return null;
    const b = raw as Record<string, unknown>;
    const event = calendar ? b.eventAfterDays : b.eventAfterObservations;
    if (typeof b.id !== 'string' || !b.id || ids.has(b.id) || typeof b.title !== 'string' || typeof b.event !== 'string' || !finite(b.shockPct) || b.shockPct < -80 || b.shockPct > 100 || !finite(event) || !Number.isInteger(event) || event < 0 || event > horizon || (calendar ? b.eventAfterObservations : b.eventAfterDays) !== undefined || !Array.isArray(b.path) || !b.path.length || b.path.length > 1000) return null;
    ids.add(b.id);
    let previous = -1;
    for (const rawPoint of b.path) {
      if (!rawPoint || typeof rawPoint !== 'object') return null;
      const point = rawPoint as Record<string, unknown>;
      const offset = calendar ? point.days : point.observations;
      if (!finite(offset) || offset < 0 || offset > horizon || offset <= previous || (calendar ? point.observations : point.days) !== undefined || typeof point.eventApplied !== 'boolean' || !finite(point.lowerPrice) || !finite(point.medianPrice) || !finite(point.upperPrice) || point.lowerPrice <= 0 || point.lowerPrice > point.medianPrice || point.medianPrice > point.upperPrice) return null;
      previous = offset;
    }
    if (previous !== horizon) return null;
  }
  return value as SimulationProjection;
}

const getApiBase = (): string | null => {
  if (import.meta.env.DEV && import.meta.env.VITE_API_TARGET) return '/api';
  const base = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '');
  return base || null;
};

async function monitorRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = getApiBase() ?? (import.meta.env.DEV ? '/profile-api' : null);
  if (!base) throw new Error('La connexion à l’API de veille n’est pas configurée.');
  const response = await authenticatedFetch(`${base}/v1/portfolio-monitor/${path}`, {
    ...init, headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  if (!response.ok) {
    let message = 'La veille du portefeuille est indisponible.';
    try { const body = await response.json() as { detail?: string }; if (typeof body.detail === 'string') message = body.detail; } catch { /* Keep stable local error. */ }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export const loadPortfolioWatchlist = (persona: DemoOverview['persona'], signal?: AbortSignal) =>
  monitorRequest<{ persona: DemoOverview['persona']; items: PortfolioWatchItem[] }>(`watchlist?persona=${encodeURIComponent(persona)}`, { signal });
export const addPortfolioWatch = (input: Pick<PortfolioWatchItem, 'persona' | 'positionId' | 'ticker'>) =>
  monitorRequest<PortfolioWatchItem>('watchlist', { method: 'POST', body: JSON.stringify(input) });
export const removePortfolioWatch = (persona: DemoOverview['persona'], ticker: string) =>
  monitorRequest<{ deleted: boolean }>(`watchlist/${encodeURIComponent(ticker)}?persona=${encodeURIComponent(persona)}`, { method: 'DELETE' });
export const loadPortfolioNewsCases = (persona: DemoOverview['persona'], signal?: AbortSignal) =>
  monitorRequest<{ persona: DemoOverview['persona']; cases: PortfolioNewsCase[] }>(`cases?persona=${encodeURIComponent(persona)}`, { signal });
export const updatePortfolioNewsCase = (persona: DemoOverview['persona'], id: string, status: 'read' | 'resolved') =>
  monitorRequest<PortfolioNewsCase>(`cases/${encodeURIComponent(id)}?persona=${encodeURIComponent(persona)}&status=${status}`, { method: 'PATCH' });
export const startPortfolioNewsScan = (persona: DemoOverview['persona']) =>
  monitorRequest<PortfolioMonitorScan>(`refresh?persona=${encodeURIComponent(persona)}`, { method: 'POST' });
export const getPortfolioNewsScan = (persona: DemoOverview['persona'], id: string, signal?: AbortSignal) =>
  monitorRequest<PortfolioMonitorScan>(`scans/${encodeURIComponent(id)}?persona=${encodeURIComponent(persona)}`, { signal });

export async function loadDemoOverview(persona: DemoOverview['persona'] = 'mateo', signal?: AbortSignal): Promise<DemoApiConnection> {
  const base = getApiBase();
  if (!base) return { status: 'not_configured' };

  try {
    const response = await authenticatedFetch(`${base}/v1/demo/overview?persona=${encodeURIComponent(persona)}`, {
      headers: { Accept: 'application/json' },
      signal,
    });
    if (response.status === 429) return { status: 'rate_limited' };
    if (!response.ok) return { status: 'unavailable' };

    const overview = (await response.json()) as DemoOverview;
    if (overview.mode !== 'demo' || overview.source !== 'aws-dynamodb' || overview.persona !== persona || !overview.profile?.is_demo) {
      return { status: 'unavailable' };
    }
    return { status: 'connected', overview };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return { status: 'unavailable' };
  }
}

export async function calculateDemoScenario(
  persona: DemoOverview['persona'],
  input: { name: string; shocks: PortfolioScenarioShock[] },
  signal?: AbortSignal,
): Promise<PortfolioScenarioImpact> {
  const base = getApiBase();
  if (!base) throw new Error('La connexion à l’API de démonstration n’est pas configurée.');
  const response = await authenticatedFetch(`${base}/v1/demo/scenarios/impact?persona=${encodeURIComponent(persona)}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok) {
    let message = 'Le calcul conditionnel a échoué.';
    try {
      const error = await response.json() as { detail?: string };
      if (typeof error.detail === 'string') message = error.detail;
    } catch { /* Keep the stable local error message. */ }
    throw new Error(message);
  }
  const result = await response.json() as PortfolioScenarioImpact;
  if (result.persona !== persona || result.provenance?.assumptions !== 'user_supplied_conditional_shocks') {
    throw new Error('La réponse du scénario ne correspond pas au compte actif.');
  }
  return result;
}

async function getSimulation<T>(path: string, signal?: AbortSignal): Promise<T> {
  const base = getApiBase() ?? (import.meta.env.DEV ? '/profile-api' : null);
  if (!base) throw new Error('La connexion à l’API de Simulation n’est pas configurée.');
  const response = await authenticatedFetch(`${base}/v1/simulation/${path}`, { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) {
    let message = 'Les données historiques sont indisponibles.';
    try {
      const error = await response.json() as { detail?: string };
      if (typeof error.detail === 'string') message = error.detail;
    } catch { /* Keep a stable error when the server response is not JSON. */ }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export const loadSimulationAssets = (signal?: AbortSignal) => getSimulation<SimulationAssetList>('assets', signal);
export const loadSimulationHistory = (ticker: string, signal?: AbortSignal) =>
  getSimulation<SimulationHistory>(`history/${encodeURIComponent(ticker)}`, signal);
export const loadSimulationEventStudy = (ticker: string, eventDate: string, signal?: AbortSignal) =>
  getSimulation<SimulationEventStudy>(`event-study/${encodeURIComponent(ticker)}?event_date=${encodeURIComponent(eventDate)}`, signal);
export const loadSimulationRegulations = (topic: string, page = 1, startDate?: string, endDate?: string, signal?: AbortSignal) => {
  const params = new URLSearchParams({ topic, page: String(page) });
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  return getSimulation<SimulationRegulations>(`regulations?${params.toString()}`, signal);
};
export const loadSimulationFilings = (ticker: string, startDate?: string, signal?: AbortSignal) =>
  getSimulation<SimulationFilings>(`filings/${encodeURIComponent(ticker)}${startDate ? `?start_date=${encodeURIComponent(startDate)}` : ''}`, signal);
export const loadSimulationNews = (ticker: string, signal?: AbortSignal) =>
  getSimulation<SimulationNews>(`news/${encodeURIComponent(ticker)}`, signal);
export const loadSimulationSocialPosts = (ticker: string, signal?: AbortSignal, accounts: string[] = []) => {
  const query = accounts.length ? `?accounts=${encodeURIComponent(accounts.join(','))}` : '';
  return getSimulation<SimulationSocialPosts>(`social/${encodeURIComponent(ticker)}${query}`, signal);
};
export async function runSimulationProjection(input: SimulationProjectionInput, signal?: AbortSignal): Promise<SimulationProjection> {
  const base = getApiBase() ?? (import.meta.env.DEV ? '/profile-api' : null);
  if (!base) throw new Error('La connexion à l’API de Simulation n’est pas configurée.');
  const response = await authenticatedFetch(`${base}/v1/simulation/scenarios`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok) {
    let message = 'Le calcul de scénario est indisponible.';
    try {
      const error = await response.json() as { detail?: string };
      if (typeof error.detail === 'string') message = error.detail;
    } catch { /* Keep a stable error when the server response is not JSON. */ }
    throw new Error(message);
  }
  const result = parseSimulationProjection(await response.json());
  if (!result) throw new Error('Le résultat de simulation ne respecte pas ses unités ou ses valeurs attendues.');
  const calendar = input.horizonDays !== undefined;
  const horizon = calendar ? input.horizonDays : input.horizonObservations;
  if (result.ticker.toUpperCase() !== input.ticker.toUpperCase() || simulationHorizon(result) !== horizon || (result.timeUnit === 'calendar_days') !== calendar || result.branches.length !== input.branches.length || input.branches.some(branch => { const returned = result.branches.find(item => item.id === branch.id); return !returned || returned.shockPct !== branch.shockPct || simulationEventOffset(returned) !== simulationEventOffset(branch); })) throw new Error('Le résultat de simulation ne correspond pas au titre, à l’horizon ou aux hypothèses demandées.');
  return result;
}

export type PublicXPost = {metrics?: {replies?:number; reposts?:number; likes?:number; views?:number; bookmarks?:number}; id: string; text: string; created_at?: string; url?: string; images?: string[]};
export type PublicXProfile = { detailsVersion?: number; following?: number; joinedAt?: string | null; website?: string | null; location?: string; recentPosts?: PublicXPost[]; postsObservedAt?: string; postsSource?: string; id: string; username: string; name: string; image?: string; bio?: string; followers?: number; verified?: boolean; verifiedType?: string; source: string; latestPost: { id: string; text: string; created_at?: string } | null; latestPostReason?: string };
export type AnythingSite = { name: string; description: string; operations: number };
export const loadSourceCatalog = (signal?: AbortSignal) => getSimulation<{ sites: AnythingSite[] }>('source-catalog', signal);
export const loadSourceOperations = (site: string, signal?: AbortSignal) => getSimulation<{ site: string; baseUrl?: string; notes?: string; operations: Array<{ name: string; description: string; params: string[]; returns?: string[]; readOnly?: boolean }> }>(`source-operations/${encodeURIComponent(site)}`, signal);
export const loadPublicXProfile = (username: string, signal?: AbortSignal) => getSimulation<PublicXProfile>(`x-profile/${encodeURIComponent(username.replace(/^@/, ''))}`, signal);
export type SourceWorkspace = { hidden_sources?: string[]; learning_job?: string | null; selected: string; query: string; profile: PublicXProfile | null; authorized: PublicXProfile[]; searches: Array<{ query: string; at: string; error?: string }> };
export const loadSourceWorkspace = (account: string, signal?: AbortSignal) => getSimulation<SourceWorkspace>(`source-workspace/${encodeURIComponent(account)}`, signal);
export async function saveSourceWorkspace(account: string, workspace: SourceWorkspace): Promise<SourceWorkspace> {
  const base = getApiBase() ?? (import.meta.env.DEV ? '/profile-api' : null);
  if (!base) throw new Error('La connexion au serveur n’est pas configurée.');
  const response = await authenticatedFetch(`${base}/v1/simulation/source-workspace/${encodeURIComponent(account)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(workspace) });
  if (!response.ok) throw new Error('Impossible d’enregistrer les modifications sur le serveur.');
  return response.json();
}
export type SourceLearning = { status: 'running' | 'complete' | 'error'; events: Array<{message: string; at?: string}>; url?: string; frame: number; site?: string; result?: { signature?: string; error?: string }; };
export const sourceLearningBase = () => `${getApiBase() ?? '/profile-api'}/v1/simulation/source-learning`;
export async function startSourceLearning(account: string, url: string): Promise<{id:string}> {
  const r = await authenticatedFetch(`${sourceLearningBase()}/${account}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})});
  if (!r.ok) { const data = await r.json(); throw new Error(data.detail || 'Apprentissage indisponible.'); }
  return r.json();
}
export const loadSourceLearning = (account: string, job: string, signal?: AbortSignal) => getSimulation<SourceLearning>(`source-learning/${account}/${job}`,signal);

export const loadPublicXPosts = (username: string, signal?: AbortSignal) => getSimulation<{ available: boolean; posts: PublicXPost[]; reason?: string; source?: string; observedAt?: string }>(`x-posts/${encodeURIComponent(username)}`, signal);

export async function runAnalysisForecast(input: SimulationProjectionInput, signal?: AbortSignal): Promise<SimulationProjection> {
 const horizon = input.horizonObservations;
 if (horizon === undefined) throw new Error('Ce modèle utilise un horizon en séances.');
 const base = getApiBase() ?? (import.meta.env.DEV ? '/profile-api' : null);
 if (!base) throw new Error('API de simulation non configurée.');
 const response = await authenticatedFetch(`${base}/v1/simulation/forecast`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal });
 if (!response.ok) throw new Error(`Estimation indisponible (${response.status}).`);
 const parsed = parseSimulationProjection(await response.json());
 if (!parsed || parsed.ticker !== input.ticker.trim().toUpperCase() || parsed.timeUnit === 'calendar_days' || simulationHorizon(parsed) !== horizon || parsed.branches.length !== input.branches.length || input.branches.some(branch => {
  const returned = parsed.branches.find(item => item.id === branch.id);
  return !returned || returned.title !== branch.title.trim() || returned.event !== branch.event.trim() || returned.sourceUrl !== (branch.sourceUrl?.trim() || undefined) || returned.shockPct !== branch.shockPct || simulationEventOffset(returned) !== simulationEventOffset(branch) || returned.path.length !== horizon + 1 || returned.path.some((point, index) => simulationPointOffset(point) !== index);
 })) throw new Error('Le résultat ne correspond pas à l’horizon ou aux hypothèses demandées.');
 return parsed;
}

export async function loadMarketMovements(input: { analysisId: string; accountId: string; ticker: string; start: string; end: string; thresholdPct: number; refresh?: boolean }, signal?: AbortSignal): Promise<MarketMovementReport> {
 const base = getApiBase() ?? (import.meta.env.DEV ? '/profile-api' : null);
 if (!base) throw new Error('API d’analyse des variations non configurée.');
 const query = new URLSearchParams({ accountId: input.accountId, ticker: input.ticker, start: input.start, end: input.end, thresholdPct: String(input.thresholdPct), ...(input.refresh ? { refresh: 'true' } : {}) });
 const response = await authenticatedFetch(`${base}/v1/profiles/research/${encodeURIComponent(input.analysisId)}/movements?${query}`, { signal });
 if (!response.ok) throw new Error(`Lecture des variations indisponible (${response.status}).`);
 const result = await response.json() as MarketMovementReport;
 const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
 if (!result || result.analysisId !== input.analysisId || result.ticker !== input.ticker || result.thresholdPct !== input.thresholdPct || !Array.isArray(result.movements) || !Number.isFinite(Date.parse(result.asOf)) || !/^[A-Z]{3}$/.test(result.currency) || typeof result.method !== 'string' || !Array.isArray(result.limitations) || !result.limitations.every(item => typeof item === 'string') || !result.evidenceCoverage || !finite(result.evidenceCoverage.documentsRead) || !result.source || typeof result.source.title !== 'string' || result.totalMoves !== result.movements.length) throw new Error('Le relevé de variations reçu est incomplet ou ne correspond pas à cette analyse.');
 const ids = new Set<string>();
 for (const move of result.movements) {
  if (!move || typeof move.id !== 'string' || ids.has(move.id) || !Number.isFinite(Date.parse(move.date)) || !Number.isFinite(Date.parse(move.previousDate)) || move.previousDate >= move.date || move.date < input.start || move.date > input.end || !finite(move.price) || move.price <= 0 || !finite(move.previousPrice) || move.previousPrice <= 0 || !finite(move.changePct) || Math.abs((move.price / move.previousPrice - 1) * 100 - move.changePct) > 0.0001 || !['up', 'down'].includes(move.direction) || (move.changePct >= 0) !== (move.direction === 'up') || !['context_found', 'unexplained'].includes(move.status) || typeof move.explanation !== 'string' || !Array.isArray(move.candidates)) throw new Error('Une variation reçue ne correspond pas aux cours ou aux dates affichés.');
  ids.add(move.id);
  for (const item of move.candidates) if (!item || !['id', 'title', 'url', 'sourceName', 'sourceId', 'evidenceId', 'publishedAt', 'excerpt'].every(key => typeof item[key as keyof MarketMovementCandidate] === 'string') || !Number.isFinite(Date.parse(item.publishedAt)) || !finite(item.charactersRead) || item.charactersRead <= 0 || !item.excerpt.trim() || !['timestamp', 'date'].includes(item.publicationPrecision) || !['interval', 'date_only'].includes(item.timing)) throw new Error('Une source de contexte ne fournit pas son extrait lu et sa date de publication.');
 }
 return result;
}
