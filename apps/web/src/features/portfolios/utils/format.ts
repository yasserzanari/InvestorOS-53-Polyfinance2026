export const usd = (value: number, decimals = 0) => new Intl.NumberFormat('fr-CA', {
  style: 'currency',
  currency: 'USD',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: decimals,
  maximumFractionDigits: decimals,
}).format(value);

export const pct = (value: number, decimals = 1) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(decimals)} %`;

export const shortDate = (value: string) => new Date(value).toLocaleDateString('fr-CA', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export const portfolioPeriods = [
  { label: '1M', bars: 21 },
  { label: '3M', bars: 63 },
  { label: '6M', bars: 126 },
  { label: 'YTD', bars: 190 },
  { label: '1A', bars: 253 },
];
