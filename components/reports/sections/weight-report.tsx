'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReportShell, type DateRange } from '../report-shell';
import { LineChart } from '../charts';
import { downloadCsv, toCsv } from '@/lib/export/csv';
import { formatDate } from '@/lib/utils';

type Row = {
  id: string;
  cat_id: string;
  weight_kg: number;
  recorded_at: string;
  notes: string | null;
  cat: { id: string; name: string } | null;
  submitter: { id: string; full_name: string } | null;
};

function defaultRange(): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 90);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function WeightReport() {
  const [range, setRange] = useState<DateRange>(defaultRange());

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ['report-weight', range.from, range.to],
    queryFn: async () => {
      const r = await fetch(`/api/reports/weight-logs?from=${range.from}&to=${range.to}`, { cache: 'no-store' });
      if (!r.ok) return [];
      return (await r.json()).rows;
    }
  });

  // Group by cat for chart series
  const series = useMemo(() => {
    const map = new Map<string, { name: string; points: { x: string; y: number }[] }>();
    // Sort ascending so chart lines flow left to right
    const sorted = [...rows].sort((a, b) => (a.recorded_at < b.recorded_at ? -1 : 1));
    for (const r of sorted) {
      if (!r.cat) continue;
      const key = r.cat.id;
      if (!map.has(key)) map.set(key, { name: r.cat.name, points: [] });
      map.get(key)!.points.push({ x: r.recorded_at, y: r.weight_kg });
    }
    return Array.from(map.values());
  }, [rows]);

  function exportCsv() {
    const csv = toCsv(rows, [
      { key: 'recorded_at', header: 'Date',      format: (v) => formatDate(String(v)) },
      { key: 'cat',         header: 'Cat',       format: (v) => (v as Row['cat'])?.name ?? '' },
      { key: 'weight_kg',   header: 'Weight kg' },
      { key: 'submitter',   header: 'Submitted by', format: (v) => (v as Row['submitter'])?.full_name ?? '' },
      { key: 'notes',       header: 'Notes' }
    ]);
    downloadCsv(`weight-logs-${range.from}-to-${range.to}`, csv);
  }

  return (
    <ReportShell
      title="Weight logs"
      description="Weight readings per cat with trend chart."
      defaultRange={range}
      onRangeChange={setRange}
      onExport={exportCsv}
      exportDisabled={rows.length === 0}
    >
      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!isLoading && (
        <>
          {series.length > 0 && <LineChart data={series} yLabel="kg" />}
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase border-b">
                <tr>
                  <th className="text-left py-2 pr-3">Date</th>
                  <th className="text-left py-2 pr-3">Cat</th>
                  <th className="text-right py-2 pr-3">Weight (kg)</th>
                  <th className="text-left py-2 pr-3">Submitted by</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={4} className="py-3 text-center text-muted-foreground">No data.</td></tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{formatDate(r.recorded_at)}</td>
                    <td className="py-2 pr-3">{r.cat?.name ?? '—'}</td>
                    <td className="py-2 pr-3 text-right font-medium">{Number(r.weight_kg).toFixed(3)}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.submitter?.full_name ?? '—'}</td>
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
