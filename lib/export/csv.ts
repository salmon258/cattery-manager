/**
 * Lightweight CSV serialiser.
 * - Quotes any value containing comma, quote, or newline.
 * - Escapes embedded quotes by doubling them.
 * - Coerces null/undefined to empty string.
 * - Booleans → "true" / "false".
 * - Date objects → ISO string.
 */
export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; header: string; format?: (v: unknown, row: T) => string }[]
): string {
  const headerLine = columns.map((c) => escape(c.header)).join(',');
  const dataLines = rows.map((row) =>
    columns.map((c) => {
      const raw = c.format ? c.format(row[c.key], row) : row[c.key];
      return escape(stringify(raw));
    }).join(',')
  );
  return [headerLine, ...dataLines].join('\n');
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function escape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Browser-side download helper.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
