// Display formatters shared by the web and mobile apps, so both show figures
// identically.

export const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(Math.round(n));
export const fmtD = (n: number) =>
  '£' + fmt(n);
export const pct = (n: number) =>
  n.toFixed(1) + '%';

export const fmtGBP = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(Math.round(v));

export function formatCurrencyShort(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${sign}£${Math.round(abs / 1000)}k`;
  return `${sign}£${Math.round(abs)}`;
}

export function formatCurrencyFull(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}${new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(Math.abs(value))}`;
}
