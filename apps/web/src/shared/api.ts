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

export type DemoApiConnection =
  | { status: 'not_configured' }
  | { status: 'connected'; overview: DemoOverview }
  | { status: 'rate_limited' }
  | { status: 'unavailable' };

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
  method: string;
  limitations: string[];
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
export type ScenarioBranchInput = {
  id: string;
  title: string;
  event: string;
  sourceUrl?: string;
  shockPct: number;
  eventAfterObservations: number;
};
export type SimulationProjection = {
  ticker: string;
  horizonObservations: number;
  asOf: string;
  startingPrice: number;
  currency: string;
  source: string;
  branches: Array<ScenarioBranchInput & { path: Array<{ observations: number; eventApplied: boolean; lowerPrice: number; medianPrice: number; upperPrice: number }> }>;
  method: string;
  limitations: string[];
};

const getApiBase = (): string | null => {
  if (import.meta.env.DEV && import.meta.env.VITE_API_TARGET) return '/api';
  const base = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '');
  return base || null;
};

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
export async function runSimulationProjection(input: {
  ticker: string;
  horizonObservations: number;
  branches: ScenarioBranchInput[];
}, signal?: AbortSignal): Promise<SimulationProjection> {
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
  return response.json() as Promise<SimulationProjection>;
}
