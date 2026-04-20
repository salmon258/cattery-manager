export function formatMoney(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return '0';
  const num = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(num)) return '0';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num);
}

export function formatCurrency(
  n: number | string | null | undefined,
  currency: string | null | undefined
): string {
  return `${formatMoney(n)} ${currency ?? ''}`.trim();
}

export function firstOfMonth(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

export function lastOfMonth(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}

export function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return firstOfMonth(d);
}
