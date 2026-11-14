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
    positions: Array<{ id: string; label: string; weight_pct: number; value: number }>;
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

const getApiBase = (): string | null => {
  if (import.meta.env.DEV && import.meta.env.VITE_API_TARGET) return '/api';
  const base = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '');
  return base || null;
};

export async function loadDemoOverview(persona: DemoOverview['persona'] = 'mateo', signal?: AbortSignal): Promise<DemoApiConnection> {
  const base = getApiBase();
  if (!base) return { status: 'not_configured' };

  try {
    const response = await fetch(`${base}/v1/demo/overview?persona=${encodeURIComponent(persona)}`, {
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
  const response = await fetch(`${base}/v1/demo/scenarios/impact?persona=${encodeURIComponent(persona)}`, {
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
