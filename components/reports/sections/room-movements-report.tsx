'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReportShell, type DateRange } from '../report-shell';
import { downloadCsv, toCsv } from '@/lib/export/csv';
import { formatDate } from '@/lib/utils';

type Row = {
  id: string;
  moved_at: string;
  reason: string | null;
  cat: { id: string; name: string } | null;
  from_room: { id: string; name: string } | null;
  to_room:   { id: string; name: string } | null;
  mover:     { id: string; full_name: string } | null;
};

function defaultRange(): DateRange {
  const to = new Date();
  const from = new Date(); from.setMonth(from.getMonth() - 3);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function RoomMovementsReport() {
  const [range, setRange] = useState<DateRange>(defaultRange());

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ['report-rooms', range.from, range.to],
    queryFn: async () => {
      const r = await fetch(`/api/reports/room-movements?from=${range.from}&to=${range.to}`, { cache: 'no-store' });
      if (!r.ok) return [];
      return (await r.json()).rows;
    }
  });

  function exportCsv() {
    const csv = toCsv(rows, [
      { key: 'moved_at',  header: 'When',     format: (v) => new Date(String(v)).toLocaleString() },
      { key: 'cat',       header: 'Cat',      format: (v) => (v as Row['cat'])?.name ?? '' },
      { key: 'from_room', header: 'From',     format: (v) => (v as Row['from_room'])?.name ?? '' },
      { key: 'to_room',   header: 'To',       format: (v) => (v as Row['to_room'])?.name ?? '' },
      { key: 'mover',     header: 'Moved by', format: (v) => (v as Row['mover'])?.full_name ?? '' },
      { key: 'reason',    header: 'Reason' }
    ]);
    downloadCsv(`room-movements-${range.from}-to-${range.to}`, csv);
  }

  return (
    <ReportShell
      title="Room movements"
      description="Full audit trail of cat room transitions."
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
                <th className="text-left py-2 pr-3">When</th>
                <th className="text-left py-2 pr-3">Cat</th>
                <th className="text-left py-2 pr-3">From</th>
                <th className="text-left py-2 pr-3">To</th>
                <th className="text-left py-2 pr-3">By</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5} className="py-3 text-center text-muted-foreground">No data.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 text-xs">{formatDate(r.moved_at)}</td>
                  <td className="py-2 pr-3">{r.cat?.name ?? '—'}</td>
                  <td className="py-2 pr-3">{r.from_room?.name ?? '—'}</td>
                  <td className="py-2 pr-3 font-medium">{r.to_room?.name ?? '—'}</td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">{r.mover?.full_name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ReportShell>
  );
}
