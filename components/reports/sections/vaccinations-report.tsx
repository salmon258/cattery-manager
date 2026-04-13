'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { ReportShell, type DateRange } from '../report-shell';
import { Badge } from '@/components/ui/badge';
import { downloadCsv, toCsv } from '@/lib/export/csv';
import { formatDate } from '@/lib/utils';

type Row = {
  id: string;
  vaccine_type: string;
  given_date: string;
  next_due_date: string | null;
  notes: string | null;
  cat: { id: string; name: string } | null;
  overdue: boolean;
};

function defaultRange(): DateRange {
  const to = new Date(); to.setDate(to.getDate() + 30);
  const from = new Date(); from.setFullYear(from.getFullYear() - 1);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function VaccinationsReport() {
  const [range, setRange] = useState<DateRange>(defaultRange());

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ['report-vac', range.from, range.to],
    queryFn: async () => {
      const r = await fetch(`/api/reports/vaccinations?from=${range.from}&to=${range.to}`, { cache: 'no-store' });
      if (!r.ok) return [];
      return (await r.json()).rows;
    }
  });

  const overdueCount = rows.filter((r) => r.overdue).length;

  function exportCsv() {
    const csv = toCsv(rows, [
      { key: 'cat',           header: 'Cat',        format: (v) => (v as Row['cat'])?.name ?? '' },
      { key: 'vaccine_type',  header: 'Vaccine' },
      { key: 'given_date',    header: 'Given',      format: (v) => formatDate(String(v)) },
      { key: 'next_due_date', header: 'Next due',   format: (v) => v ? formatDate(String(v)) : '' },
      { key: 'overdue',       header: 'Overdue' },
      { key: 'notes',         header: 'Notes' }
    ]);
    downloadCsv(`vaccinations-${range.from}-to-${range.to}`, csv);
  }

  return (
    <ReportShell
      title="Vaccinations"
      description="Past vaccinations with next due dates; overdue rows flagged."
      defaultRange={range}
      onRangeChange={setRange}
      onExport={exportCsv}
      exportDisabled={rows.length === 0}
    >
      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!isLoading && (
        <>
          {overdueCount > 0 && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2 mb-3 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="h-4 w-4" />
              {overdueCount} overdue vaccinations
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase border-b">
                <tr>
                  <th className="text-left py-2 pr-3">Cat</th>
                  <th className="text-left py-2 pr-3">Vaccine</th>
                  <th className="text-left py-2 pr-3">Given</th>
                  <th className="text-left py-2 pr-3">Next due</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={4} className="py-3 text-center text-muted-foreground">No data.</td></tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className={'border-b last:border-0 ' + (r.overdue ? 'bg-red-50/50 dark:bg-red-900/10' : '')}>
                    <td className="py-2 pr-3">{r.cat?.name ?? '—'}</td>
                    <td className="py-2 pr-3 capitalize">{r.vaccine_type.replace(/_/g, ' ')}</td>
                    <td className="py-2 pr-3">{formatDate(r.given_date)}</td>
                    <td className="py-2 pr-3">
                      {r.next_due_date ? formatDate(r.next_due_date) : '—'}
                      {r.overdue && <Badge className="ml-2 text-xs bg-red-100 text-red-700 border-0">Overdue</Badge>}
                    </td>
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
