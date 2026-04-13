'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReportShell, type DateRange } from '../report-shell';
import { downloadCsv, toCsv } from '@/lib/export/csv';
import { formatDate } from '@/lib/utils';

type EatingRow = {
  id: string;
  cat_id: string;
  meal_time: string;
  feeding_method: 'self' | 'assisted' | 'force_fed';
  notes: string | null;
  cat: { id: string; name: string } | null;
  submitter: { id: string; full_name: string } | null;
  items: {
    id: string;
    quantity_given_g: number;
    quantity_eaten: 'all' | 'most' | 'half' | 'little' | 'none';
    estimated_kcal_consumed: number | null;
    food: { id: string; name: string; brand: string | null; type: string } | null;
  }[];
};

function defaultRange(): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 14);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function EatingReport() {
  const [range, setRange] = useState<DateRange>(defaultRange());

  const { data: rows = [], isLoading } = useQuery<EatingRow[]>({
    queryKey: ['report-eating', range.from, range.to],
    queryFn: async () => {
      const r = await fetch(`/api/reports/eating-logs?from=${range.from}&to=${range.to}`, { cache: 'no-store' });
      if (!r.ok) return [];
      return (await r.json()).rows;
    }
  });

  const totals = useMemo(() => {
    let totalGrams = 0;
    let totalKcal  = 0;
    for (const r of rows) {
      for (const it of r.items) {
        totalGrams += Number(it.quantity_given_g ?? 0);
        totalKcal  += Number(it.estimated_kcal_consumed ?? 0);
      }
    }
    return { totalGrams, totalKcal, sessions: rows.length };
  }, [rows]);

  function exportCsv() {
    // Flatten: one row per item
    type FlatRow = {
      meal_time: string;
      cat: string;
      food: string;
      grams: number;
      eaten: string;
      kcal: number | null;
      method: string;
      submitter: string;
    };
    const flat: FlatRow[] = rows.flatMap((r) =>
      r.items.length > 0
        ? r.items.map((it) => ({
            meal_time:    r.meal_time,
            cat:          r.cat?.name ?? '',
            food:         it.food?.name ?? '',
            grams:        Number(it.quantity_given_g),
            eaten:        String(it.quantity_eaten),
            kcal:         it.estimated_kcal_consumed != null ? Number(it.estimated_kcal_consumed) : null,
            method:       String(r.feeding_method),
            submitter:    r.submitter?.full_name ?? ''
          }))
        : [{
            meal_time:    r.meal_time,
            cat:          r.cat?.name ?? '',
            food:         '',
            grams:        0,
            eaten:        'none',
            kcal:         null,
            method:       String(r.feeding_method),
            submitter:    r.submitter?.full_name ?? ''
          }]
    );
    const csv = toCsv(flat, [
      { key: 'meal_time', header: 'Time',     format: (v) => formatDate(String(v)) },
      { key: 'cat',       header: 'Cat' },
      { key: 'food',      header: 'Food' },
      { key: 'grams',     header: 'Grams' },
      { key: 'eaten',     header: 'Eaten' },
      { key: 'kcal',      header: 'kcal' },
      { key: 'method',    header: 'Method' },
      { key: 'submitter', header: 'Submitted by' }
    ]);
    downloadCsv(`eating-logs-${range.from}-to-${range.to}`, csv);
  }

  return (
    <ReportShell
      title="Eating logs"
      description="Feeding sessions with food items and calorie totals."
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
              <div className="text-xs text-muted-foreground">Sessions</div>
              <div className="text-xl font-semibold">{totals.sessions}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Total grams</div>
              <div className="text-xl font-semibold">{Math.round(totals.totalGrams)} g</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Total calories</div>
              <div className="text-xl font-semibold">{Math.round(totals.totalKcal)} kcal</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase border-b">
                <tr>
                  <th className="text-left py-2 pr-3">Date</th>
                  <th className="text-left py-2 pr-3">Cat</th>
                  <th className="text-left py-2 pr-3">Items</th>
                  <th className="text-right py-2 pr-3">Grams</th>
                  <th className="text-right py-2 pr-3">kcal</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="py-3 text-center text-muted-foreground">No data.</td></tr>
                )}
                {rows.map((r) => {
                  const grams = r.items.reduce((s, i) => s + Number(i.quantity_given_g ?? 0), 0);
                  const kcal  = r.items.reduce((s, i) => s + Number(i.estimated_kcal_consumed ?? 0), 0);
                  return (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">{formatDate(r.meal_time)}</td>
                      <td className="py-2 pr-3">{r.cat?.name ?? '—'}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {r.items.map((i) => i.food?.name).filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="py-2 pr-3 text-right">{Math.round(grams)}</td>
                      <td className="py-2 pr-3 text-right">{Math.round(kcal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </ReportShell>
  );
}
