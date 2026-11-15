import { fieldOrder, type FieldKey } from '../../profile-model';

export type InsightStatus = 'tension' | 'clarification' | 'information' | 'partial';

export type PortfolioBasis = {
  portfolioName: string;
  currency: string;
  positions: { label: string; weightPct: number }[];
};

export type InsightData = {
  type: 'insight';
  title: string;
  question: string;
  summary: string;
  status: InsightStatus;
  fields: FieldKey[];
  evidenceIds: string[];
  alternatives: string[];
  nextQuestion: string;
  limits: string[];
  profileSnapshot?: Partial<Record<FieldKey, string>>;
  portfolioBasis?: PortfolioBasis;
  createdAt?: string;
};

export type Metric = {
  ticker: string;
  name: string;
  returnPct: number;
  periodVolatilityPct: number;
  drawdownPct: number;
  source: string;
  sourceUrl: string;
  sourceAsOf?: string;
  sourceDescription?: string;
  classification: string;
  excludedObservations: number;
};

export type ComparisonMetric = Metric;
export type ComparisonSeriesPoint = Record<string, string | number>;

export type ComparisonData = {
  type: 'comparison';
  title: string;
  currency: string;
  period: { from: string; to: string };
  observations: number;
  metrics: Metric[];
  series: ComparisonSeriesPoint[];
  dataSha256: string;
  method?: string;
  methodDetails: string;
  limits: string[];
  createdAt: string;
};

const MAX_CONTENT_LENGTH = 64_000;
const FIELD_KEYS = new Set<string>(fieldOrder);
const INSIGHT_STATUSES = new Set<string>(['tension', 'clarification', 'information', 'partial']);

function invalid(): never {
  throw new Error('Invalid decision content');
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}

function text(value: unknown, maxLength: number, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > maxLength || (!allowEmpty && !value.trim())) return invalid();
  return value;
}

function optionalText(value: unknown, maxLength: number): string | undefined {
  return value === undefined || value === null ? undefined : text(value, maxLength);
}

function timestamp(value: unknown): string {
  const result = text(value, 80);
  return Number.isFinite(Date.parse(result)) ? result : invalid();
}

function finite(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return invalid();
  return value;
}

function integer(value: unknown, minimum: number, maximum: number): number {
  const number = finite(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) return invalid();
  return number;
}

function array(value: unknown, minimum: number, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) return invalid();
  return value;
}

function texts(value: unknown, maxItems: number, maxLength: number): string[] {
  return value === undefined ? [] : array(value, 0, maxItems).map(item => text(item, maxLength));
}

function day(value: unknown): string {
  const date = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return invalid();
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return invalid();
  return date;
}

function currency(value: unknown): string {
  const code = text(value, 3);
  return /^[A-Z]{3}$/.test(code) ? code : invalid();
}

function field(value: unknown): FieldKey {
  const key = text(value, 32);
  return FIELD_KEYS.has(key) ? key as FieldKey : invalid();
}

function snapshot(value: unknown): Partial<Record<FieldKey, string>> | undefined {
  if (value === undefined) return undefined;
  const raw = record(value);
  if (Object.keys(raw).length > fieldOrder.length) return invalid();
  const result: Partial<Record<FieldKey, string>> = {};
  for (const [key, declaration] of Object.entries(raw)) {
    result[field(key)] = text(declaration, 2_000, true);
  }
  return result;
}

function portfolioBasis(value: unknown): PortfolioBasis | undefined {
  if (value === undefined) return undefined;
  const raw = record(value);
  return {
    portfolioName: text(raw.portfolioName, 160),
    currency: currency(raw.currency),
    positions: array(raw.positions, 1, 100).map(item => {
      const position = record(item);
      const weightPct = finite(position.weightPct);
      if (weightPct < 0 || weightPct > 100) return invalid();
      return { label: text(position.label, 160), weightPct };
    }),
  };
}

function insight(raw: Record<string, unknown>): InsightData {
  const status = text(raw.status, 32);
  if (!INSIGHT_STATUSES.has(status)) return invalid();
  const fields = array(raw.fields, 1, fieldOrder.length).map(field);
  if (new Set(fields).size !== fields.length) return invalid();
  const profileSnapshot = snapshot(raw.profileSnapshot);
  const basis = portfolioBasis(raw.portfolioBasis);
  const createdAt = raw.createdAt === undefined ? undefined : timestamp(raw.createdAt);
  return {
    type: 'insight',
    title: text(raw.title, 100),
    question: text(raw.question, 600),
    summary: text(raw.summary, 800),
    status: status as InsightStatus,
    fields,
    evidenceIds: texts(raw.evidenceIds, 10, 256),
    alternatives: texts(raw.alternatives, 4, 300),
    nextQuestion: raw.nextQuestion === undefined ? '' : text(raw.nextQuestion, 400, true),
    limits: texts(raw.limits, 5, 2_000),
    ...(profileSnapshot === undefined ? {} : { profileSnapshot }),
    ...(basis === undefined ? {} : { portfolioBasis: basis }),
    ...(createdAt === undefined ? {} : { createdAt }),
  };
}

function metric(value: unknown): Metric {
  const raw = record(value);
  const ticker = text(raw.ticker, 16);
  if (!/^[A-Za-z0-9.^=-]+$/.test(ticker)) return invalid();
  const returnPct = finite(raw.returnPct);
  const periodVolatilityPct = finite(raw.periodVolatilityPct);
  const drawdownPct = finite(raw.drawdownPct);
  if (returnPct < -100 || periodVolatilityPct < 0 || drawdownPct < -100 || drawdownPct > 0) return invalid();
  const sourceAsOf = raw.sourceAsOf === undefined || raw.sourceAsOf === null ? undefined : timestamp(raw.sourceAsOf);
  const sourceDescription = optionalText(raw.sourceDescription, 2_000);
  return {
    ticker,
    name: text(raw.name, 300),
    returnPct,
    periodVolatilityPct,
    drawdownPct,
    source: text(raw.source, 1_000),
    sourceUrl: text(raw.sourceUrl, 2_000),
    classification: text(raw.classification, 100),
    excludedObservations: integer(raw.excludedObservations, 0, 1_000_000),
    ...(sourceAsOf === undefined ? {} : { sourceAsOf }),
    ...(sourceDescription === undefined ? {} : { sourceDescription }),
  };
}

function comparison(raw: Record<string, unknown>): ComparisonData {
  const metrics = array(raw.metrics, 2, 3).map(metric);
  const tickers = metrics.map(item => item.ticker);
  if (new Set(tickers.map(ticker => ticker.toUpperCase())).size !== tickers.length) return invalid();
  const rawPeriod = record(raw.period);
  const period = { from: day(rawPeriod.from), to: day(rawPeriod.to) };
  if (period.from > period.to) return invalid();
  const observations = integer(raw.observations, 3, 1_000_000);
  let previousDate = '';
  const series = array(raw.series, 3, Math.min(observations, 200)).map(value => {
    const row = record(value);
    const date = day(row.date);
    if (date <= previousDate || date < period.from || date > period.to) return invalid();
    if (Object.keys(row).length !== tickers.length + 1) return invalid();
    previousDate = date;
    const point: ComparisonSeriesPoint = { date };
    for (const ticker of tickers) {
      const index = finite(row[ticker]);
      if (index <= 0) return invalid();
      point[ticker] = index;
    }
    return point;
  });
  if (series[0].date !== period.from || series[series.length - 1].date !== period.to) return invalid();
  const dataSha256 = text(raw.dataSha256, 64);
  if (!/^[a-fA-F0-9]{64}$/.test(dataSha256)) return invalid();
  const method = optionalText(raw.method, 100);
  return {
    type: 'comparison',
    title: text(raw.title, 100),
    currency: currency(raw.currency),
    period,
    observations,
    metrics,
    series,
    dataSha256,
    ...(method === undefined ? {} : { method }),
    methodDetails: text(raw.methodDetails, 4_000),
    limits: texts(raw.limits, 10, 2_000),
    createdAt: timestamp(raw.createdAt),
  };
}

export function parseDecisionContent(content: string, tabId: string): InsightData | ComparisonData | null {
  if (typeof content !== 'string' || !content || content.length > MAX_CONTENT_LENGTH) return null;
  try {
    const raw = record(JSON.parse(content));
    const type = raw.type === undefined
      ? tabId === 'profile-alignment' ? 'insight' : tabId === 'profile-comparison' ? 'comparison' : undefined
      : raw.type;
    if (type === 'insight') return insight(raw);
    if (type === 'comparison') return comparison(raw);
    return null;
  } catch {
    return null;
  }
}
