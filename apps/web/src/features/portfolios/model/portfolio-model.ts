export type HoldingDefinition = {
  symbol: string;
  name: string;
  color: string;
  target: number;
  initialPrice: number;
  quantity: number;
};

export type PortfolioPoint = {
  step: number;
  date: string;
  value: number;
  benchmark: number;
  drawdown: number;
};

export type PortfolioPosition = HoldingDefinition & {
  price: number;
  value: number;
  weight: number;
  returnPct: number;
  dayChange: number;
  pnl: number;
  sparkline: number[];
  volatility: number;
  maxDrawdown: number;
};

export type MonthlyReturnRow = {
  symbol: string;
  name: string;
  color: string;
  values: (number | null)[];
};

export type RebalanceEvent = {
  step: number;
  date: string;
  kind: 'mensuel' | 'manuel';
  nav: number;
  turnover: number;
  moved: number;
  weights: number[];
};

export const INITIAL_CAPITAL = 2_124_380;
export const PORTFOLIO_STEPS = 252;
export const REPLAY_START_STEP = 96;
export const months = ['Jan.', 'Fév.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];

const definitions = [
  { symbol: 'QQQ', name: 'Nasdaq-100', color: '#526bbd', target: 20, initialPrice: 616.84 },
  { symbol: 'AMD', name: 'AMD', color: '#8a72bc', target: 16, initialPrice: 252.85 },
  { symbol: 'GOOGL', name: 'Alphabet A', color: '#3896ad', target: 16, initialPrice: 259.90 },
  { symbol: 'AAPL', name: 'Apple', color: '#25958b', target: 16, initialPrice: 263.00 },
  { symbol: 'NVDA', name: 'NVIDIA', color: '#c58d35', target: 16, initialPrice: 186.26 },
  { symbol: 'AMZN', name: 'Amazon', color: '#bf7295', target: 16, initialPrice: 224.19 },
];

const holdings: HoldingDefinition[] = definitions.map((holding) => ({
  ...holding,
  quantity: INITIAL_CAPITAL * holding.target / 100 / holding.initialPrice,
}));

function datesForSessions() {
  const result: string[] = [];
  let time = Date.UTC(2025, 9, 24, 20);
  while (result.length <= PORTFOLIO_STEPS) {
    const day = new Date(time).getUTCDay();
    if (day !== 0 && day !== 6) result.push(new Date(time).toISOString());
    time += 86_400_000;
  }
  return result;
}

const dates = datesForSessions();
const monthKeys = [...new Set(dates.map((date) => date.slice(0, 7)))];
export const monthLabels = monthKeys.map((key) => `${months[Number(key.slice(5)) - 1]} ${key.slice(2, 4)}`);
const monthEnds = new Set(dates.flatMap((date, step) => step < PORTFOLIO_STEPS && date.slice(0, 7) !== dates[step + 1].slice(0, 7) ? [step] : []));
const anchors: [number, number][] = [
  [0, 0], [5, 3.3], [25, 0.4], [48, -0.7], [70, 2.2], [90, -4.3],
  [112, -10.2], [134, 15.1], [155, 20.5], [177, 15.6], [200, 24.5],
  [221, 19.0], [243, 28.8], [252, 31.2],
];
const sensitivities = [0.62, 1.48, 1.08, 0.72, 1.32, 1.10];
const annualDrifts = [-0.015, 0.058, 0.078, -0.036, 0.008, 0.021];

function randomSource(seed: number) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

function makePrices(assetIndex: number) {
  const random = randomSource(8_125 + assetIndex * 9_173);
  const prices = [holdings[assetIndex].initialPrice];
  for (let segment = 1; segment < anchors.length; segment += 1) {
    const [start, from] = anchors[segment - 1];
    const [end, to] = anchors[segment];
    const length = end - start;
    const noise = Array.from({ length }, () => (random() + random() + random() - 1.5) * 0.018 * (0.7 + sensitivities[assetIndex] * 0.55));
    const averageNoise = noise.reduce((sum, value) => sum + value, 0) / length;
    let bridge = 0;
    for (let offset = 1; offset <= length; offset += 1) {
      const step = start + offset;
      const commonReturn = (from + (to - from) * offset / length) / 100;
      const cycle = Math.sin(step * 0.052 + assetIndex * 1.1) - Math.sin(assetIndex * 1.1);
      bridge += noise[offset - 1] - averageNoise;
      const logReturn = Math.log(1 + commonReturn) * sensitivities[assetIndex]
        + annualDrifts[assetIndex] * step / PORTFOLIO_STEPS
        + cycle * 0.018 * Math.sin(step / PORTFOLIO_STEPS * Math.PI)
        + bridge;
      prices.push(holdings[assetIndex].initialPrice * Math.exp(logReturn));
    }
  }
  return prices;
}

const prices = holdings.map((_, index) => makePrices(index));
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const variance = (values: number[]) => {
  const mean = average(values);
  return average(values.map((value) => (value - mean) ** 2));
};
const changes = (values: number[]) => values.slice(1).map((value, index) => value / values[index] - 1);
const direction = (amount: number) => amount > 0.01 ? 'achat' : amount < -0.01 ? 'vente' : 'conserver';

type EngineSession = { quantities: number[]; capitalFlows: number[]; nav: number };
type Engine = { sessions: EngineSession[]; points: PortfolioPoint[]; rebalances: RebalanceEvent[] };
const engines = new Map<string, Engine>();

function getEngine(manualSteps: number[]): Engine {
  const manual = [...new Set(manualSteps.filter(Number.isFinite).map(Math.floor).filter((step) => step > 0 && step <= PORTFOLIO_STEPS))].sort((a, b) => a - b);
  const key = manual.join(',');
  const cached = engines.get(key);
  if (cached) return cached;
  const manualSet = new Set(manual);
  const sessions: EngineSession[] = [];
  const rebalances: RebalanceEvent[] = [];
  let quantities = holdings.map((holding) => holding.quantity);
  let capitalFlows = holdings.map((holding) => INITIAL_CAPITAL * holding.target / 100);
  let peak = INITIAL_CAPITAL;
  const points: PortfolioPoint[] = [];
  for (let step = 0; step <= PORTFOLIO_STEPS; step += 1) {
    let values = quantities.map((quantity, index) => quantity * prices[index][step]);
    let nav = values.reduce((sum, value) => sum + value, 0);
    if (step > 0 && (monthEnds.has(step) || manualSet.has(step))) {
      const weights = values.map((value) => value / nav * 100);
      const trades = holdings.map((holding, index) => nav * holding.target / 100 - values[index]);
      quantities = quantities.map((quantity, index) => quantity + trades[index] / prices[index][step]);
      capitalFlows = capitalFlows.map((flow, index) => flow + trades[index]);
      values = quantities.map((quantity, index) => quantity * prices[index][step]);
      nav = values.reduce((sum, value) => sum + value, 0);
      const moved = trades.reduce((sum, amount) => sum + Math.abs(amount), 0) / 2;
      rebalances.push({ step, date: dates[step], kind: manualSet.has(step) ? 'manuel' : 'mensuel', nav, weights, turnover: moved / nav * 100, moved });
    }
    sessions.push({ quantities: [...quantities], capitalFlows: [...capitalFlows], nav });
    peak = Math.max(peak, nav);
    points.push({ step, date: dates[step], value: nav, benchmark: INITIAL_CAPITAL * prices[0][step] / prices[0][0], drawdown: (nav / peak - 1) * 100 });
  }
  const engine = { sessions, points, rebalances };
  if (engines.size >= 8) engines.delete(engines.keys().next().value!);
  engines.set(key, engine);
  return engine;
}

function monthReturn(key: string, step: number, values: number[]) {
  const start = dates.findIndex((date) => date.startsWith(key));
  if (start > step) return null;
  let end = dates.length - 1;
  while (end >= 0 && !dates[end].startsWith(key)) end -= 1;
  return (values[Math.min(step, end)] / values[Math.max(0, start - 1)] - 1) * 100;
}

export function getPortfolioSnapshot(requestedStep: number, manualSteps: number[] = []) {
  const step = Number.isFinite(requestedStep) ? Math.max(0, Math.min(PORTFOLIO_STEPS, Math.floor(requestedStep))) : PORTFOLIO_STEPS;
  const engine = getEngine(manualSteps);
  const session = engine.sessions[step];
  const positions: PortfolioPosition[] = holdings.map((holding, index) => {
    const price = prices[index][step];
    const quantity = session.quantities[index];
    const value = quantity * price;
    const trail = prices[index].slice(Math.max(0, step - 63), step + 1);
    const returns = changes(trail);
    let high = trail[0] ?? price;
    const drawdown = trail.map((item) => { high = Math.max(high, item); return (item / high - 1) * 100; });
    return { ...holding, quantity, price, value, weight: value / session.nav * 100, returnPct: (price / holding.initialPrice - 1) * 100, dayChange: price / prices[index][Math.max(0, step - 1)] - 1, pnl: value - session.capitalFlows[index], sparkline: trail, volatility: Math.sqrt(variance(returns) * 252) * 100, maxDrawdown: Math.min(0, ...drawdown) };
  });
  const points = engine.points.slice(0, step + 1);
  const visible = points.slice(-64);
  const portfolioReturns = changes(visible.map((point) => point.value));
  const benchmarkReturns = changes(visible.map((point) => point.benchmark));
  const portfolioMean = average(portfolioReturns);
  const benchmarkMean = average(benchmarkReturns);
  const volatility = Math.sqrt(variance(portfolioReturns));
  const benchmarkVariance = variance(benchmarkReturns);
  const covariance = average(portfolioReturns.map((value, index) => (value - portfolioMean) * (benchmarkReturns[index] - benchmarkMean)));
  const returnPct = (session.nav / INITIAL_CAPITAL - 1) * 100;
  const visibleMonthly = monthKeys.map((key) => {
    const portfolioValues = engine.points.map((point) => point.value);
    return { key, value: monthReturn(key, step, portfolioValues) };
  }).filter((row) => row.value !== null);
  const monthlyReturns: MonthlyReturnRow[] = [
    { symbol: 'MODEL', name: 'Modèle', color: '#256c78', values: monthKeys.map((key) => monthReturn(key, step, engine.points.map((point) => point.value))) },
    ...holdings.map((holding, index) => ({ symbol: holding.symbol, name: holding.symbol, color: holding.color, values: monthKeys.map((key) => monthReturn(key, step, prices[index])) })),
  ];
  const peak = Math.max(...points.map((point) => point.value));
  const maxDrawdown = Math.min(...points.map((point) => point.drawdown));
  const rebalances = engine.rebalances.filter((event) => event.step <= step);
  return {
    step, date: dates[step], total: session.nav, gain: session.nav - INITIAL_CAPITAL, returnPct,
    benchmarkReturn: (points.at(-1)?.benchmark ?? INITIAL_CAPITAL) / INITIAL_CAPITAL * 100 - 100,
    points, positions, monthlyReturns, rebalances, recentRebalances: rebalances.slice(-8),
    bestMonth: Math.max(0, ...visibleMonthly.map((row) => row.value ?? 0)),
    metrics: {
      volatility: volatility * Math.sqrt(252) * 100,
      sharpe: volatility ? (portfolioMean * 252 - 0.02) / (volatility * Math.sqrt(252)) : 0,
      maxDrawdown,
      beta: benchmarkVariance ? covariance / benchmarkVariance : 0,
    },
  };
}

export function getRebalancePreview(positions: PortfolioPosition[]) {
  const total = positions.reduce((sum, position) => sum + position.value, 0);
  return positions.map((position) => {
    const amount = total * position.target / 100 - position.value;
    return { ...position, amount, deltaWeight: position.target - position.weight, side: direction(amount) };
  });
}

export const portfolioHoldings = holdings;
export type PortfolioSnapshot = ReturnType<typeof getPortfolioSnapshot>;
