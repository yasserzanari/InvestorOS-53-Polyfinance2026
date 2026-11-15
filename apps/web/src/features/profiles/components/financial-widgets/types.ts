export type WidgetPeriodKey = '1D' | '1W' | '1M' | '1Y';
export type WidgetDataStatus = 'ready' | 'partial' | 'unavailable';
export type WidgetView = 'portfolio' | 'heatmap' | 'allocation' | 'contributions' | 'sectors';

export type FinancialWidgetPosition = {
  id: string;
  label: string;
  ticker: string | null;
  sector: string | null;
  value: number;
  weightPct: number;
};

export type FinancialWidgetSector = {
  id: string;
  label: string;
  value: number;
  weightPct: number;
};

export type FinancialWidgetPoint = { date: string; value: number };
export type FinancialWidgetPeriodPosition = {
  id: string;
  changePct: number | null;
  changeValue: number | null;
  contributionPct: number | null;
  changeBasis?: 'valuation_history' | 'adjusted_price_history' | 'unavailable';
  reason?: string | null;
  source?: string | null;
};
export type FinancialWidgetPeriodSector = {
  id: string;
  changePct: number | null;
  changeValue: number | null;
};
export type FinancialWidgetPeriod = {
  status: WidgetDataStatus;
  reason: string | null;
  start: string | null;
  end: string | null;
  points: FinancialWidgetPoint[];
  changeValue: number | null;
  changePct: number | null;
  positions: FinancialWidgetPeriodPosition[];
  sectors: FinancialWidgetPeriodSector[];
};

export type FinancialWidgetData = {
  id?: string;
  accountId?: string;
  schemaVersion: 1;
  kind: 'portfolio_widget';
  view: WidgetView;
  period: WidgetPeriodKey;
  title: string;
  portfolioName: string;
  persona: string;
  currency: string;
  asOf: string;
  status: WidgetDataStatus;
  totalValue: number;
  positions: FinancialWidgetPosition[];
  sectors: FinancialWidgetSector[];
  periods: Record<WidgetPeriodKey, FinancialWidgetPeriod>;
  provenance: {
    source: string;
    classification: string;
    method: string;
    limitations: string[];
  };
  limitations: string[];
};

const PERIOD_KEYS: WidgetPeriodKey[] = ['1D', '1W', '1M', '1Y'];
const WIDGET_VIEWS: WidgetView[] = ['portfolio', 'heatmap', 'allocation', 'contributions', 'sectors'];
const STATUSES: WidgetDataStatus[] = ['ready', 'partial', 'unavailable'];
const CHANGE_BASES = ['valuation_history', 'adjusted_price_history', 'unavailable'] as const;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, maximum = 240): string | null => typeof value === 'string' && value.trim().length > 0 && value.length <= maximum ? value.trim() : null;
const nullableText = (value: unknown, maximum = 500): string | null => value === null || value === undefined ? null : text(value, maximum);
const finite = (value: unknown, minimum = -1e16, maximum = 1e16): number | null => typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum ? value : null;
const nullableFinite = (value: unknown, minimum = -1e16, maximum = 1e16): number | null => value === null || value === undefined ? null : finite(value, minimum, maximum);
const dateText = (value: unknown): string | null => {
  const result = text(value, 80);
  return result && Number.isFinite(Date.parse(result)) ? result : null;
};
function stringList(value: unknown, maxItems: number, maxText = 500): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const items = value.map((entry) => text(entry, maxText));
  return items.every((entry): entry is string => entry !== null) ? items : null;
}
function parsePosition(value: unknown): FinancialWidgetPosition | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, 100);
  const label = text(value.label, 160);
  const ticker = nullableText(value.ticker, 24);
  const sector = nullableText(value.sector, 120);
  const amount = finite(value.value, 0);
  const weightPct = finite(value.weightPct, 0, 100);
  if (!id || !label || (value.ticker !== null && value.ticker !== undefined && !ticker) || (value.sector !== null && value.sector !== undefined && !sector) || amount === null || weightPct === null) return null;
  return { id, label, ticker, sector, value: amount, weightPct };
}
function parseSector(value: unknown): FinancialWidgetSector | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, 100);
  const label = text(value.label, 160);
  const amount = finite(value.value, 0);
  const weightPct = finite(value.weightPct, 0, 100);
  if (!id || !label || amount === null || weightPct === null) return null;
  return { id, label, value: amount, weightPct };
}
function parsePeriodPosition(value: unknown): FinancialWidgetPeriodPosition | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, 100);
  const changePct = nullableFinite(value.changePct, -10000, 10000);
  const changeValue = nullableFinite(value.changeValue);
  const contributionPct = nullableFinite(value.contributionPct, -10000, 10000);
  const changeBasis = value.changeBasis === undefined ? undefined : CHANGE_BASES.includes(value.changeBasis as typeof CHANGE_BASES[number]) ? value.changeBasis as typeof CHANGE_BASES[number] : null;
  const reason = value.reason === undefined ? undefined : nullableText(value.reason, 500);
  const source = value.source === undefined ? undefined : nullableText(value.source, 300);
  if (!id || (value.changePct !== null && value.changePct !== undefined && changePct === null) || (value.changeValue !== null && value.changeValue !== undefined && changeValue === null) || (value.contributionPct !== null && value.contributionPct !== undefined && contributionPct === null) || changeBasis === null || (value.reason !== undefined && value.reason !== null && reason === null) || (value.source !== undefined && value.source !== null && source === null)) return null;
  return { id, changePct, changeValue, contributionPct, ...(changeBasis ? { changeBasis } : {}), ...(reason !== undefined ? { reason } : {}), ...(source !== undefined ? { source } : {}) };
}
function parsePeriodSector(value: unknown): FinancialWidgetPeriodSector | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, 100);
  const changePct = nullableFinite(value.changePct, -10000, 10000);
  const changeValue = nullableFinite(value.changeValue);
  if (!id || (value.changePct !== null && value.changePct !== undefined && changePct === null) || (value.changeValue !== null && value.changeValue !== undefined && changeValue === null)) return null;
  return { id, changePct, changeValue };
}
function parsePeriod(value: unknown): FinancialWidgetPeriod | null {
  if (!isRecord(value) || !STATUSES.includes(value.status as WidgetDataStatus)) return null;
  const reason = nullableText(value.reason, 500);
  const start = value.start === null ? null : dateText(value.start);
  const end = value.end === null ? null : dateText(value.end);
  const changeValue = nullableFinite(value.changeValue);
  const changePct = nullableFinite(value.changePct, -10000, 10000);
  if ((value.reason !== null && value.reason !== undefined && reason === null) || (value.start !== null && value.start !== undefined && start === null) || (value.end !== null && value.end !== undefined && end === null) || (value.changeValue !== null && value.changeValue !== undefined && changeValue === null) || (value.changePct !== null && value.changePct !== undefined && changePct === null)) return null;
  if (!Array.isArray(value.points) || value.points.length > 600 || !Array.isArray(value.positions) || value.positions.length > 300 || !Array.isArray(value.sectors) || value.sectors.length > 80) return null;
  const points = value.points.map((point) => {
    if (!isRecord(point)) return null;
    const date = dateText(point.date);
    const amount = finite(point.value, 0);
    return date && amount !== null ? { date, value: amount } : null;
  });
  const positions = value.positions.map(parsePeriodPosition);
  const sectors = value.sectors.map(parsePeriodSector);
  if (points.some((point) => point === null) || positions.some((position) => position === null) || sectors.some((sector) => sector === null)) return null;
  return {
    status: value.status as WidgetDataStatus,
    reason,
    start,
    end,
    points: points as FinancialWidgetPoint[],
    changeValue,
    changePct,
    positions: positions as FinancialWidgetPeriodPosition[],
    sectors: sectors as FinancialWidgetPeriodSector[],
  };
}

/** Strictly validate the server event or locally persisted JSON before rendering it. */
export function parseFinancialWidget(value: unknown): FinancialWidgetData | null {
  if (!isRecord(value) || value.kind !== 'portfolio_widget' || value.schemaVersion !== 1 || !WIDGET_VIEWS.includes(value.view as WidgetView) || !PERIOD_KEYS.includes(value.period as WidgetPeriodKey) || !STATUSES.includes(value.status as WidgetDataStatus)) return null;
  const title = text(value.title, 180);
  const portfolioName = text(value.portfolioName, 160);
  const persona = text(value.persona, 120);
  const currency = text(value.currency, 3);
  const asOf = text(value.asOf, 80);
  const totalValue = finite(value.totalValue, 0);
  const id = value.id === undefined ? undefined : text(value.id, 160);
  const accountId = value.accountId === undefined ? undefined : text(value.accountId, 160);
  if (!title || !portfolioName || !persona || !currency || !/^[A-Z]{3}$/.test(currency) || !asOf || totalValue === null || (value.id !== undefined && !id) || (value.accountId !== undefined && !accountId)) return null;
  if (!Array.isArray(value.positions) || value.positions.length > 300 || !Array.isArray(value.sectors) || value.sectors.length > 80) return null;
  const positions = value.positions.map(parsePosition);
  const sectors = value.sectors.map(parseSector);
  if (positions.some((position) => position === null) || sectors.some((sector) => sector === null)) return null;
  if (!isRecord(value.periods)) return null;
  const periods = {} as Record<WidgetPeriodKey, FinancialWidgetPeriod>;
  for (const key of PERIOD_KEYS) {
    const period = parsePeriod(value.periods[key]);
    if (!period) return null;
    periods[key] = period;
  }
  if (!isRecord(value.provenance)) return null;
  const provenanceSource = text(value.provenance.source, 200);
  const classification = text(value.provenance.classification, 100);
  const method = text(value.provenance.method, 300);
  const provenanceLimitations = stringList(value.provenance.limitations, 50);
  const limitations = stringList(value.limitations, 50);
  if (!provenanceSource || !classification || !method || !provenanceLimitations || !limitations) return null;
  return {
    ...(id ? { id } : {}),
    ...(accountId ? { accountId } : {}),
    schemaVersion: 1,
    kind: 'portfolio_widget',
    view: value.view as WidgetView,
    period: value.period as WidgetPeriodKey,
    title,
    portfolioName,
    persona,
    currency,
    asOf,
    status: value.status as WidgetDataStatus,
    totalValue,
    positions: positions as FinancialWidgetPosition[],
    sectors: sectors as FinancialWidgetSector[],
    periods,
    provenance: { source: provenanceSource, classification, method, limitations: provenanceLimitations },
    limitations,
  };
}
