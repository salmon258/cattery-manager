'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReportShell, type DateRange } from '../report-shell';
import { downloadCsv, toCsv } from '@/lib/export/csv';
import { formatDate } from '@/lib/utils';

type Row = {
  id: string;
  visit_date: string;
  visit_type: string;
  status: string;
  diagnosis: string | null;
  visit_cost: number | null;
  transport_cost: number | null;
  cat: { id: string; name: string } | null;
  clinic: { id: string; name: string } | null;
  doctor: { id: string; full_name: string } | null;
};

function defaultRange(): DateRange {
  const to = new Date();
  const from = new Date(); from.setMonth(from.getMonth() - 6);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function VetVisitsReport() {
  const [range, setRange] = useState<DateRange>(defaultRange());

  const { data, isLoading } = useQuery<{ rows: Row[]; totals: { visit: number; transport: number } }>({
    queryKey: ['report-vet', range.from, range.to],
    queryFn: async () => {
      const r = await fetch(`/api/reports/vet-visits?from=${range.from}&to=${range.to}`, { cache: 'no-store' });
      if (!r.ok) return { rows: [], totals: { visit: 0, transport: 0 } };
      return r.json();
    }
  });

  const rows   = data?.rows   ?? [];
  const totals = data?.totals ?? { visit: 0, transport: 0 };

  function exportCsv() {
    const csv = toCsv(rows, [
      { key: 'visit_date',     header: 'Date',       format: (v) => formatDate(String(v)) },
      { key: 'cat',            header: 'Cat',        format: (v) => (v as Row['cat'])?.name ?? '' },
      { key: 'visit_type',     header: 'Type' },
      { key: 'clinic',         header: 'Clinic',     format: (v) => (v as Row['clinic'])?.name ?? '' },
      { key: 'doctor',         header: 'Doctor',     format: (v) => (v as Row['doctor'])?.full_name ?? '' },
      { key: 'diagnosis',      header: 'Diagnosis' },
      { key: 'visit_cost',     header: 'Visit cost' },
      { key: 'transport_cost', header: 'Transport cost' }
    ]);
    downloadCsv(`vet-visits-${range.from}-to-${range.to}`, csv);
  }

  return (
    <ReportShell
      title="Vet visits"
      description="All vet visits with cost totals."
      defaultRange={range}
      onRangeChange={setRange}
      onExport={exportCsv}
      exportDisabled={rows.length === 0}
    >
      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!isLoading && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Visits</div>
              <div className="text-xl font-semibold">{rows.length}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Total visit cost</div>
              <div className="text-xl font-semibold">{totals.visit.toLocaleString()}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Total transport cost</div>
              <div className="text-xl font-semibold">{totals.transport.toLocaleString()}</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase border-b">
                <tr>
                  <th className="text-left py-2 pr-3">Date</th>
                  <th className="text-left py-2 pr-3">Cat</th>
                  <th className="text-left py-2 pr-3">Type</th>
                  <th className="text-left py-2 pr-3">Clinic</th>
                  <th className="text-left py-2 pr-3">Diagnosis</th>
                  <th className="text-right py-2 pr-3">Cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="py-3 text-center text-muted-foreground">No data.</td></tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{formatDate(r.visit_date)}</td>
                    <td className="py-2 pr-3">{r.cat?.name ?? '—'}</td>
                    <td className="py-2 pr-3 text-xs">{r.visit_type.replace(/_/g, ' ')}</td>
                    <td className="py-2 pr-3">{r.clinic?.name ?? '—'}</td>
                    <td className="py-2 pr-3 text-xs truncate max-w-[200px]">{r.diagnosis ?? '—'}</td>
                    <td className="py-2 pr-3 text-right">{r.visit_cost != null ? Number(r.visit_cost).toLocaleString() : '—'}</td>
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
