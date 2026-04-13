'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReportShell, type DateRange } from '../report-shell';
import { downloadCsv, toCsv } from '@/lib/export/csv';
import { formatDate } from '@/lib/utils';

type Row = {
  id: string;
  medicine_name: string;
  dose: string;
  route: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  cat: { id: string; name: string } | null;
  confirmed: number;
  missed: number;
  pending: number;
  skipped: number;
  compliance_rate: number | null;
};

function defaultRange(): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function complianceClass(rate: number | null): string {
  if (rate === null) return 'text-muted-foreground';
  if (rate >= 0.9) return 'text-emerald-600';
  if (rate >= 0.7) return 'text-amber-600';
  return 'text-destructive';
}

export function MedicationComplianceReport() {
  const [range, setRange] = useState<DateRange>(defaultRange());

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ['report-meds', range.from, range.to],
    queryFn: async () => {
      const r = await fetch(`/api/reports/medication-compliance?from=${range.from}&to=${range.to}`, { cache: 'no-store' });
      if (!r.ok) return [];
      return (await r.json()).rows;
    }
  });

  function exportCsv() {
    const csv = toCsv(rows, [
      { key: 'cat',             header: 'Cat',          format: (v) => (v as Row['cat'])?.name ?? '' },
      { key: 'medicine_name',   header: 'Medicine' },
      { key: 'dose',            header: 'Dose' },
      { key: 'route',           header: 'Route' },
      { key: 'start_date',      header: 'Start',        format: (v) => formatDate(String(v)) },
      { key: 'end_date',        header: 'End',          format: (v) => formatDate(String(v)) },
      { key: 'confirmed',       header: 'Confirmed' },
      { key: 'missed',          header: 'Missed' },
      { key: 'pending',         header: 'Pending' },
      { key: 'skipped',         header: 'Skipped' },
      { key: 'compliance_rate', header: 'Compliance %', format: (v) => v !== null ? `${Math.round(Number(v) * 100)}%` : '' }
    ]);
    downloadCsv(`medication-compliance-${range.from}-to-${range.to}`, csv);
  }

  return (
    <ReportShell
      title="Medication compliance"
      description="Confirmed vs missed dose tasks per medication plan in the date range."
      defaultRange={range}
      onRangeChange={setRange}
      onExport={exportCsv}
      exportDisabled={rows.length === 0}
    >
      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!isLoading && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase border-b">
              <tr>
                <th className="text-left py-2 pr-3">Cat</th>
                <th className="text-left py-2 pr-3">Medicine</th>
                <th className="text-left py-2 pr-3">Period</th>
                <th className="text-right py-2 pr-3">Done</th>
                <th className="text-right py-2 pr-3">Missed</th>
                <th className="text-right py-2 pr-3">Pending</th>
                <th className="text-right py-2 pr-3">Compliance</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="py-3 text-center text-muted-foreground">No data.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{r.cat?.name ?? '—'}</td>
                  <td className="py-2 pr-3">
                    <div className="font-medium">{r.medicine_name}</div>
                    <div className="text-xs text-muted-foreground">{r.dose} · {r.route}</div>
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">
                    {formatDate(r.start_date)} → {formatDate(r.end_date)}
                  </td>
                  <td className="py-2 pr-3 text-right text-emerald-600">{r.confirmed}</td>
                  <td className="py-2 pr-3 text-right text-destructive">{r.missed}</td>
                  <td className="py-2 pr-3 text-right text-muted-foreground">{r.pending}</td>
                  <td className={`py-2 pr-3 text-right font-medium ${complianceClass(r.compliance_rate)}`}>
                    {r.compliance_rate !== null ? `${Math.round(r.compliance_rate * 100)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ReportShell>
  );
}
