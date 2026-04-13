'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReportShell, type DateRange } from '../report-shell';
import { downloadCsv, toCsv } from '@/lib/export/csv';
import { formatDate } from '@/lib/utils';

type Row = {
  id: string;
  observed_date: string;
  intensity: 'mild' | 'moderate' | 'strong';
  notes: string | null;
  cat: { id: string; name: string } | null;
  logger: { id: string; full_name: string } | null;
};

function defaultRange(): DateRange {
  const to = new Date();
  const from = new Date(); from.setMonth(from.getMonth() - 6);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function HeatLogsReport() {
  const [range, setRange] = useState<DateRange>(defaultRange());

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ['report-heat', range.from, range.to],
    queryFn: async () => {
      const r = await fetch(`/api/reports/heat-logs?from=${range.from}&to=${range.to}`, { cache: 'no-store' });
      if (!r.ok) return [];
      return (await r.json()).rows;
    }
  });

  // Per-cat: compute average cycle interval (days between consecutive observations)
  const perCat = useMemo(() => {
    const byCat = new Map<string, { name: string; dates: string[] }>();
    for (const r of rows) {
      if (!r.cat) continue;
      if (!byCat.has(r.cat.id)) byCat.set(r.cat.id, { name: r.cat.name, dates: [] });
      byCat.get(r.cat.id)!.dates.push(r.observed_date);
    }
    const result: { name: string; count: number; avgIntervalDays: number | null }[] = [];
    for (const { name, dates } of byCat.values()) {
      const sorted = [...dates].sort();
      let intervals = 0, sum = 0;
      for (let i = 1; i < sorted.length; i++) {
        const d1 = new Date(sorted[i - 1]).getTime();
        const d2 = new Date(sorted[i]).getTime();
        sum += (d2 - d1) / 86400000;
        intervals++;
      }
      result.push({ name, count: dates.length, avgIntervalDays: intervals > 0 ? Math.round(sum / intervals) : null });
    }
    return result.sort((a, b) => b.count - a.count);
  }, [rows]);

  function exportCsv() {
    const csv = toCsv(rows, [
      { key: 'observed_date', header: 'Date',      format: (v) => formatDate(String(v)) },
      { key: 'cat',           header: 'Cat',       format: (v) => (v as Row['cat'])?.name ?? '' },
      { key: 'intensity',     header: 'Intensity' },
      { key: 'logger',        header: 'Logged by', format: (v) => (v as Row['logger'])?.full_name ?? '' },
      { key: 'notes',         header: 'Notes' }
    ]);
    downloadCsv(`heat-logs-${range.from}-to-${range.to}`, csv);
  }

  return (
    <ReportShell
      title="Heat cycle log"
      description="Heat observations per female cat with average cycle interval."
      defaultRange={range}
      onRangeChange={setRange}
      onExport={exportCsv}
      exportDisabled={rows.length === 0}
    >
      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!isLoading && (
        <>
          {perCat.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Per-cat summary</h4>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase border-b">
                  <tr>
                    <th className="text-left py-1 pr-3">Cat</th>
                    <th className="text-right py-1 pr-3">Observations</th>
                    <th className="text-right py-1 pr-3">Avg interval (days)</th>
                  </tr>
                </thead>
                <tbody>
                  {perCat.map((p) => (
                    <tr key={p.name} className="border-b last:border-0">
                      <td className="py-1 pr-3">{p.name}</td>
                      <td className="py-1 pr-3 text-right">{p.count}</td>
                      <td className="py-1 pr-3 text-right">{p.avgIntervalDays ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase border-b">
                <tr>
                  <th className="text-left py-2 pr-3">Date</th>
                  <th className="text-left py-2 pr-3">Cat</th>
                  <th className="text-left py-2 pr-3">Intensity</th>
                  <th className="text-left py-2 pr-3">Logged by</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={4} className="py-3 text-center text-muted-foreground">No data.</td></tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{formatDate(r.observed_date)}</td>
                    <td className="py-2 pr-3">{r.cat?.name ?? '—'}</td>
                    <td className="py-2 pr-3 capitalize text-xs">{r.intensity}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{r.logger?.full_name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </ReportShell>
  );
}
