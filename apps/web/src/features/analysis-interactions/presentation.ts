export function dateStamp(value?: string): number {
  return value ? Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value) : NaN;
}
export function fullDate(value?: string): string {
  if(value&&/^\d{4}$/.test(value))return value;
  if(value&&/^\d{4}-\d{2}$/.test(value))return new Intl.DateTimeFormat('fr-CA',{month:'long',year:'numeric',timeZone:'UTC'}).format(Date.parse(`${value}-01T00:00:00Z`));
  const timestamp = dateStamp(value);
  return Number.isFinite(timestamp) ? new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(timestamp) : value || 'Date non fournie';
}
export function preciseDate(value?: string): string {
  if (!value || !Number.isFinite(dateStamp(value))) return value || 'Date non fournie';
  if (/^\d{4}(-\d{2})?$/.test(value))return fullDate(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return fullDate(value);
  return `${new Intl.DateTimeFormat('fr-CA', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/New_York' }).format(dateStamp(value))} (New York)`;
}
export function sourceUrl(value?: string): string | undefined {
  try { const url = new URL(value || ''); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}
export const numberLabel = (value: number) => new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 2 }).format(value);
export const moneyLabel = (value: number, currency: string) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
export function financialValue(value: number, unit: string): string {
  if (unit !== 'USD' && unit !== 'CAD') return `${numberLabel(value)} ${unit}`;
  const scale = Math.abs(value) >= 1e9 ? 1e9 : Math.abs(value) >= 1e6 ? 1e6 : 1;
  return `${numberLabel(value / scale)} ${scale === 1e9 ? 'G' : scale === 1e6 ? 'M' : ''}$ ${unit === 'USD' ? 'US' : 'CA'}`;
}
export function readableText(text: string): string {
  return text.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, date => fullDate(date));
}

export function sourceTime(time: string, zone: string): string {
  const match = time.replace(/\./g, '').trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  const place = ({ 'America/New_York': 'New York', 'Eastern Time': 'New York', 'US/Eastern': 'New York', 'America/Los_Angeles': 'Pacifique' } as Record<string, string>)[zone] || zone;
  if (!match) return `${time} (${place})`;
  let hour = Number(match[1]);
  if (match[3]) hour = hour % 12 + (match[3].toLowerCase() === 'pm' ? 12 : 0);
  return `${hour} h ${match[2]} (${place})`;
}
