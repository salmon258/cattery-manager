'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter } from 'lucide-react';
import { ReportShell, type DateRange } from '../report-shell';
import { LineChart } from '../charts';
import { Button } from '@/components/ui/button';
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

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function WeightReport() {
  const [range, setRange] = useState<DateRange>(defaultRange());
  const [selectedCatIds, setSelectedCatIds] = useState<Set<string>>(new Set());
  const [selectionInitialised, setSelectionInitialised] = useState(false);
  const [showFilter, setShowFilter] = useState(false);

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ['report-weight', range.from, range.to],
    queryFn: async () => {
      const r = await fetch(`/api/reports/weight-logs?from=${range.from}&to=${range.to}`, { cache: 'no-store' });
      if (!r.ok) return [];
      return (await r.json()).rows;
    }
  });

  // Unique cats appearing in the loaded rows, sorted by name
  const cats = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    for (const r of rows) {
      if (r.cat && !m.has(r.cat.id)) m.set(r.cat.id, r.cat);
    }
    return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  // Seed the selection with all cats the first time data lands, and
  // extend it if new cats appear on subsequent range changes.
  useEffect(() => {
    if (cats.length === 0) return;
    setSelectedCatIds((prev) => {
      if (!selectionInitialised) {
        setSelectionInitialised(true);
        return new Set(cats.map((c) => c.id));
      }
      let changed = false;
      const next = new Set(prev);
      for (const c of cats) {
        if (!next.has(c.id)) { next.add(c.id); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [cats, selectionInitialised]);

  function toggleCat(id: string) {
    setSelectedCatIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAllCats() {
    setSelectedCatIds(new Set(cats.map((c) => c.id)));
  }

  function clearCats() {
    setSelectedCatIds(new Set());
  }

  const filteredRows = useMemo(
    () => rows.filter((r) => r.cat && selectedCatIds.has(r.cat.id)),
    [rows, selectedCatIds]
  );

  // Chart series, sorted ascending by time per cat
  const series = useMemo(() => {
    const map = new Map<string, { name: string; points: { x: string; y: number }[] }>();
    const sorted = [...filteredRows].sort((a, b) => (a.recorded_at < b.recorded_at ? -1 : 1));
    for (const r of sorted) {
      if (!r.cat) continue;
      const key = r.cat.id;
      if (!map.has(key)) map.set(key, { name: r.cat.name, points: [] });
      map.get(key)!.points.push({ x: r.recorded_at, y: r.weight_kg });
    }
    return Array.from(map.values());
  }, [filteredRows]);

  // Pivot: rows = cat, columns = date (YYYY-MM-DD). If a cat has
  // multiple readings on the same day, keep the latest by recorded_at.
  const pivot = useMemo(() => {
    const dateSet = new Set<string>();
    // catId -> day -> { weight, recorded_at }
    const byCat = new Map<string, { name: string; byDay: Map<string, { weight: number; recorded_at: string }> }>();

    for (const r of filteredRows) {
      if (!r.cat) continue;
      const day = dayKey(r.recorded_at);
      dateSet.add(day);
      if (!byCat.has(r.cat.id)) byCat.set(r.cat.id, { name: r.cat.name, byDay: new Map() });
      const entry = byCat.get(r.cat.id)!;
      const prev = entry.byDay.get(day);
      if (!prev || prev.recorded_at < r.recorded_at) {
        entry.byDay.set(day, { weight: r.weight_kg, recorded_at: r.recorded_at });
      }
    }

    const dates = Array.from(dateSet).sort();
    const catRows = Array.from(byCat.entries())
      .map(([id, v]) => ({ id, name: v.name, byDay: v.byDay }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { dates, catRows };
  }, [filteredRows]);

  function exportCsv() {
    // Export the pivot (cat × date) view so the CSV matches what the user sees.
    const rowsData: Record<string, string>[] = pivot.catRows.map((cr) => {
      const cells: Record<string, string> = { Cat: cr.name };
      for (const d of pivot.dates) {
        const hit = cr.byDay.get(d);
        cells[d] = hit ? hit.weight.toFixed(3) : '';
      }
      return cells;
    });
    const columns: { key: string; header: string }[] = [
      { key: 'Cat', header: 'Cat' },
      ...pivot.dates.map((d) => ({ key: d, header: formatDate(d) }))
    ];
    const csv = toCsv(rowsData, columns);
    downloadCsv(`weight-by-day-${range.from}-to-${range.to}`, csv);
  }

  const allSelected = cats.length > 0 && selectedCatIds.size === cats.length;

  return (
    <ReportShell
      title="Weight logs"
      description="Weight readings per cat with trend chart."
      defaultRange={range}
      onRangeChange={setRange}
      onExport={exportCsv}
      exportDisabled={pivot.catRows.length === 0 || pivot.dates.length === 0}
      rightToolbar={
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowFilter((v) => !v)}
          aria-expanded={showFilter}
        >
          <Filter className="h-4 w-4" />
          {showFilter ? 'Hide filter' : 'Filter cats'}
          {cats.length > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">
              ({selectedCatIds.size}/{cats.length})
            </span>
          )}
        </Button>
      }
    >
      {showFilter && (
        <div className="mb-4 rounded-md border p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Select which cats to display on the chart and tables.
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={selectAllCats} disabled={allSelected || cats.length === 0}>
                Select all
              </Button>
              <Button size="sm" variant="ghost" onClick={clearCats} disabled={selectedCatIds.size === 0}>
                Clear
              </Button>
            </div>
          </div>
          {cats.length === 0 ? (
            <p className="text-xs text-muted-foreground">No cats in the selected range.</p>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {cats.map((c) => (
                <label key={c.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5"
                    checked={selectedCatIds.has(c.id)}
                    onChange={() => toggleCat(c.id)}
                  />
                  <span>{c.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!isLoading && (
        <>
          {series.length > 0 && <LineChart data={series} yLabel="kg" />}
          {series.length === 0 && (
            <p className="text-xs text-muted-foreground py-4">No cats selected.</p>
          )}

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase border-b">
                <tr>
                  <th className="text-left py-2 pr-3 sticky left-0 bg-background">Cat</th>
                  {pivot.dates.map((d) => (
                    <th key={d} className="text-right py-2 px-3 whitespace-nowrap">{formatDate(d)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pivot.catRows.length === 0 || pivot.dates.length === 0 ? (
                  <tr>
                    <td
                      colSpan={Math.max(1, pivot.dates.length + 1)}
                      className="py-3 text-center text-muted-foreground"
                    >
                      No data.
                    </td>
                  </tr>
                ) : (
                  pivot.catRows.map((cr) => (
                    <tr key={cr.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium sticky left-0 bg-background">{cr.name}</td>
                      {pivot.dates.map((d) => {
                        const hit = cr.byDay.get(d);
                        return (
                          <td key={d} className="py-2 px-3 text-right whitespace-nowrap">
                            {hit ? hit.weight.toFixed(3) : <span className="text-muted-foreground">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto mt-6">
            <p className="text-xs text-muted-foreground uppercase mb-2">Log entries</p>
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
                {filteredRows.length === 0 && (
                  <tr><td colSpan={4} className="py-3 text-center text-muted-foreground">No data.</td></tr>
                )}
                {filteredRows.map((r) => (
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
