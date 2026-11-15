import type { ExplorationTarget } from './types';

type Market = { market?: string; asset_class?: string };
type PriceDate = { date: string };
export type TimelineMarkerPlacement = {
  date?: string;
  precision: 'close' | 'date_only' | 'unchanged' | 'unavailable';
  note?: string;
};

const nyClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});
const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const calendarLabel = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
function sourceDay(value?: string) {
  if (!value) return undefined;
  const iso = value.match(/^\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const rfc = value.match(/(?:^|\s)(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})(?:\s|$)/i);
  if (!rfc) return undefined;
  return `${rfc[3]}-${String(months.indexOf(rfc[2].toLowerCase()) + 1).padStart(2, '0')}-${rfc[1].padStart(2, '0')}`;
}
function nyParts(stamp: number) {
  return Object.fromEntries(nyClock.formatToParts(stamp).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
}
function nyClose(day: string) {
  const nominal = Date.parse(`${day}T16:00:00Z`);
  const local = nyParts(nominal);
  const renderedAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  return nominal - (renderedAsUtc - nominal);
}
function supportsNewYorkClose(asset?: Market) {
  return /^(NASDAQ|NYSE)/i.test(asset?.market || '') && /^(equity|etf)/i.test(asset?.asset_class || '');
}
function hasExplicitClock(value: string) {
  return /\d{1,2}:\d{2}/.test(value) && /(?:Z|[+-]\d{2}:?\d{2}|\b(?:UTC|GMT|UT|EST|EDT))\s*(?:\([^)]*\))?$/i.test(value);
}

/** Use observed sessions and the same conventional NY16 reference as the movement engine. */
export function timelineMarkerPlacement(target: ExplorationTarget, prices: readonly PriceDate[], asset?: Market): TimelineMarkerPlacement {
  if (target.dateKind !== 'published') return { date: sourceDay(target.date), precision: 'unchanged' };
  const published = target.publishedAt || target.date;
  const calendarDay = sourceDay(published) || sourceDay(target.date);
  if (!calendarDay) return { precision: 'unavailable' };
  if (!published || !hasExplicitClock(published) || !Number.isFinite(Date.parse(published))) {
    return { date: calendarDay, precision: 'date_only', note: 'Repère par date; chronologie de séance non confirmée' };
  }
  if (!supportsNewYorkClose(asset)) {
    return { date: calendarDay, precision: 'date_only', note: 'Repère par date; horaire de clôture non modélisé pour ce marché' };
  }
  const stamp = Date.parse(published);
  const parts = nyParts(stamp);
  const publicationDay = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  const observations = prices.filter(point => /^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(Date.parse(`${point.date}T00:00:00Z`))).map(point => point.date).sort();
  if (!observations.length || publicationDay < observations[0]) return { precision: 'unavailable' };
  const observation = observations.find(day => day >= publicationDay && nyClose(day) >= stamp);
  if (!observation) return { precision: 'unavailable' };
  return { date: observation, precision: 'close', ...(observation !== publicationDay ? { note: `Repère à la prochaine clôture observée : ${calendarLabel.format(Date.parse(`${observation}T00:00:00Z`))}` } : {}) };
}
