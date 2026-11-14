import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export type ChartStatus = 'ready' | 'loading' | 'empty' | 'error';
export type MarketRange = { label: string; bars: number | null };
export const MARKET_RANGES: MarketRange[] = [
  { label: '1M', bars: 22 },
  { label: '3M', bars: 66 },
  { label: '6M', bars: 132 },
  { label: 'YTD', bars: 220 },
  { label: '1A', bars: 252 },
  { label: 'Tout', bars: null },
];
export const DATE_FULL = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const DATE_SHORT = new Intl.DateTimeFormat('fr-CA', { month: 'short', year: '2-digit', timeZone: 'UTC' });
export const DAY_MS = 86_400_000;
export const DOWN = '#b14660';
export const UP = '#247565';
export const SURFACE = '#ffffff';
export const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const marketVarsClassName = 'portfolio-chart-theme';

export function Keyframes() { return null; }

export function mulberry32(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function formatMoney(value: number, compact = false, currency = 'USD') {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency, currencyDisplay: 'narrowSymbol',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 2 : 0,
    minimumFractionDigits: 0,
  }).format(value);
}
export function formatAxisPrice(value: number) {
  return formatMoney(value, true);
}
export function formatSignedPct(value: number) {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)} %`;
}
export function niceTicks(minimum: number, maximum: number, target = 4) {
  if (!Number.isFinite(minimum + maximum) || maximum <= minimum) return [minimum];
  const raw = (maximum - minimum) / Math.max(1, target - 1);
  const power = 10 ** Math.floor(Math.log10(raw));
  const scaled = raw / power;
  const step = (scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10) * power;
  const first = Math.ceil(minimum / step) * step;
  const ticks: number[] = [];
  for (let tick = first; tick <= maximum + step * 1e-8 && ticks.length < 20; tick += step) ticks.push(tick);
  return ticks;
}

export function monotonePath(points: { x: number; y: number }[]) {
  if (!points.length) return '';
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  return points.reduce((path, point, index) => {
    if (index === 0) return `M${point.x},${point.y}`;
    const previous = points[index - 1];
    const middle = (previous.x + point.x) / 2;
    return `${path} C${middle},${previous.y} ${middle},${point.y} ${point.x},${point.y}`;
  }, '');
}

export function useElementWidth<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  const ref = useRef<T | null>(null);
  const attach = (node: T | null) => {
    ref.current = node;
    setElement(node);
  };
  useEffect(() => {
    if (!element) return;
    const update = () => setWidth(element.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [attach, width] as const;
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

function interpolate(from: number[], to: number[], duration: number, enabled: boolean, update: (value: number[]) => void) {
  if (!enabled || typeof window === 'undefined') { update(to); return () => {}; }
  let frame = 0;
  const started = performance.now();
  const draw = (now: number) => {
    const progress = Math.min(1, (now - started) / Math.max(1, duration));
    const eased = 1 - (1 - progress) ** 3;
    update(to.map((value, index) => from[index] + (value - from[index]) * eased));
    if (progress < 1) frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(frame);
}

export function useTween<T extends number | readonly number[]>(target: T, { duration = 300, enabled = true }: { duration?: number; enabled?: boolean } = {}): T {
  const targetValues: number[] = typeof target === 'number' ? [target] : Array.from(target as readonly number[]);
  const [values, setValues] = useState(targetValues);
  const valuesRef = useRef(values);
  valuesRef.current = values;
  useEffect(() => interpolate(valuesRef.current, targetValues, duration, enabled, setValues), [targetValues.join(','), duration, enabled]);
  return (typeof target === 'number' ? values[0] : values) as T;
}

export function useTweenNumber(target: number, { duration = 300, enabled = true }: { duration?: number; enabled?: boolean } = {}) {
  return useTween(target, { duration, enabled });
}

export function useHoverIndexKeys({ count, setIndex }: { count: number; setIndex: (index: number | null) => void }) {
  return (event: KeyboardEvent<SVGSVGElement>) => {
    if (count < 1) return;
    const current = Number(event.currentTarget.dataset.activeIndex ?? count - 1);
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End' || event.key === 'Escape') {
      event.preventDefault();
      if (event.key === 'Escape') { setIndex(null); return; }
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : Math.max(0, Math.min(count - 1, current + (event.key === 'ArrowLeft' ? -1 : 1)));
      event.currentTarget.dataset.activeIndex = String(index);
      setIndex(index);
    }
  };
}

export function RollingNumber({ value, format, className = '' }: { value: number; format: (value: number) => string; animate?: boolean; className?: string }) {
  return <span className={className} aria-live="off">{format(value)}</span>;
}

export function RangeSelector({ ranges, value, onChange, reduce }: { ranges: MarketRange[]; value: string; onChange: (range: string) => void; reduce: boolean }) {
  return <div className="portfolio-chart-ranges" role="group" aria-label="Période affichée">
    {ranges.map(range => <button key={range.label} type="button" aria-pressed={range.label === value} onClick={() => onChange(range.label)}>{range.label}</button>)}
  </div>;
}

export function ChartState({ status = 'ready', height, variant, empty, onRetry, children }: { status?: ChartStatus; height: number; variant: string; empty: { title: string; description: string }; onRetry?: () => void; children: ReactNode }) {
  if (status === 'empty') return <div className="portfolio-chart-state" style={{ minHeight: height }} role="status"><strong>{empty.title}</strong><span>{empty.description}</span></div>;
  if (status === 'loading') return <div className="portfolio-chart-state" style={{ minHeight: height }} role="status">Chargement du graphique…</div>;
  if (status === 'error') return <div className="portfolio-chart-state" style={{ minHeight: height }} role="alert"><span>Le graphique n’a pas pu être chargé.</span>{onRetry && <button type="button" onClick={onRetry}>Réessayer</button>}</div>;
  return <div data-chart-variant={variant}>{children}</div>;
}

export function ChartDataTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: string[][] }) {
  return <details className="portfolio-chart-data-table"><summary>Consulter les données du graphique</summary><div className="portfolio-chart-table-scroll"><table><caption>{caption}</caption><thead><tr>{columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map((value, cell) => cell === 0 ? <th key={cell} scope="row">{value}</th> : <td key={cell}>{value}</td>)}</tr>)}</tbody></table></div></details>;
}
