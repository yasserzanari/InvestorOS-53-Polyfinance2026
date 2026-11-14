export type DemoOverview = {
  mode: 'demo';
  source: 'aws-dynamodb';
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

const getApiBase = (): string | null => {
  if (import.meta.env.DEV && import.meta.env.VITE_API_TARGET) return '/api';
  const base = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '');
  return base || null;
};

export async function loadDemoOverview(signal?: AbortSignal): Promise<DemoApiConnection> {
  const base = getApiBase();
  if (!base) return { status: 'not_configured' };

  try {
    const response = await fetch(`${base}/v1/demo/overview`, {
      headers: { Accept: 'application/json' },
      signal,
    });
    if (response.status === 429) return { status: 'rate_limited' };
    if (!response.ok) return { status: 'unavailable' };

    const overview = (await response.json()) as DemoOverview;
    if (overview.mode !== 'demo' || overview.source !== 'aws-dynamodb' || !overview.profile?.is_demo) {
      return { status: 'unavailable' };
    }
    return { status: 'connected', overview };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return { status: 'unavailable' };
  }
}
