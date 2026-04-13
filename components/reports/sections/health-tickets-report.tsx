'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReportShell, type DateRange } from '../report-shell';
import { BarChart } from '../charts';
import { downloadCsv, toCsv } from '@/lib/export/csv';
import { formatDate } from '@/lib/utils';

type Row = {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
  resolved_at: string | null;
  resolution_summary: string | null;
  time_to_resolve_hours: number | null;
  cat: { id: string; name: string } | null;
  creator: { id: string; full_name: string } | null;
};

function defaultRange(): DateRange {
  const to = new Date();
  const from = new Date(); from.setMonth(from.getMonth() - 3);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function HealthTicketsReport() {
  const [range, setRange] = useState<DateRange>(defaultRange());

  const { data, isLoading } = useQuery<{ rows: Row[]; severityCounts: Record<string, number> }>({
    queryKey: ['report-tickets', range.from, range.to],
    queryFn: async () => {
      const r = await fetch(`/api/reports/health-tickets?from=${range.from}&to=${range.to}`, { cache: 'no-store' });
      if (!r.ok) return { rows: [], severityCounts: { low: 0, medium: 0, high: 0, critical: 0 } };
      return r.json();
    }
  });

  const rows           = data?.rows ?? [];
  const severityCounts = data?.severityCounts ?? { low: 0, medium: 0, high: 0, critical: 0 };
  const resolvedRows   = rows.filter((r) => r.time_to_resolve_hours != null);
  const avgHours = resolvedRows.length > 0
    ? Math.round(resolvedRows.reduce((s, r) => s + (r.time_to_resolve_hours ?? 0), 0) / resolvedRows.length)
    : null;

  const barData = [
    { label: 'low',      value: severityCounts.low ?? 0,      color: 'rgb(148 163 184)' },
    { label: 'medium',   value: severityCounts.medium ?? 0,   color: 'rgb(245 158 11)' },
    { label: 'high',     value: severityCounts.high ?? 0,     color: 'rgb(249 115 22)' },
    { label: 'critical', value: severityCounts.critical ?? 0, color: 'rgb(239 68 68)' }
  ];

  function exportCsv() {
    const csv = toCsv(rows, [
      { key: 'created_at',            header: 'Opened',     format: (v) => formatDate(String(v)) },
      { key: 'cat',                   header: 'Cat',        format: (v) => (v as Row['cat'])?.name ?? '' },
      { key: 'title',                 header: 'Title' },
      { key: 'severity',              header: 'Severity' },
      { key: 'status',                header: 'Status' },
      { key: 'resolved_at',           header: 'Resolved',   format: (v) => v ? formatDate(String(v)) : '' },
      { key: 'time_to_resolve_hours', header: 'Hours to resolve' },
      { key: 'creator',               header: 'Opened by',  format: (v) => (v as Row['creator'])?.full_name ?? '' }
    ]);
    downloadCsv(`health-tickets-${range.from}-to-${range.to}`, csv);
  }

  return (
    <ReportShell
      title="Health tickets"
      description="Tickets in date range with severity breakdown and time-to-resolve."
      defaultRange={range}
      onRangeChange={setRange}
      onExport={exportCsv}
      exportDisabled={rows.length === 0}
    >
      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!isLoading && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Severity breakdown</h4>
              <BarChart data={barData} height={140} />
            </div>
            <div className="space-y-2">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Total tickets</div>
                <div className="text-xl font-semibold">{rows.length}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Avg. time to resolve</div>
                <div className="text-xl font-semibold">{avgHours != null ? `${avgHours} h` : '—'}</div>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase border-b">
                <tr>
                  <th className="text-left py-2 pr-3">Opened</th>
                  <th className="text-left py-2 pr-3">Cat</th>
                  <th className="text-left py-2 pr-3">Title</th>
                  <th className="text-left py-2 pr-3">Severity</th>
                  <th className="text-left py-2 pr-3">Status</th>
                  <th className="text-right py-2 pr-3">Hours</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="py-3 text-center text-muted-foreground">No data.</td></tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{formatDate(r.created_at)}</td>
                    <td className="py-2 pr-3">{r.cat?.name ?? '—'}</td>
                    <td className="py-2 pr-3 truncate max-w-[200px]">{r.title}</td>
                    <td className="py-2 pr-3 capitalize text-xs">{r.severity}</td>
                    <td className="py-2 pr-3 capitalize text-xs">{r.status.replace('_', ' ')}</td>
                    <td className="py-2 pr-3 text-right">{r.time_to_resolve_hours ?? '—'}</td>
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
