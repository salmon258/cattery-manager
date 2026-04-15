'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReportShell, type DateRange } from '../report-shell';
import { downloadCsv, toCsv } from '@/lib/export/csv';
import { Badge } from '@/components/ui/badge';

type Row = {
  id: string;
  kind:
    | 'assignee_change'
    | 'room_move'
    | 'weight_log'
    | 'ticket_opened'
    | 'vet_visit'
    | 'eating_log'
    | 'medication_log';
  at: string;
  actor: string | null;
  cat: { id: string; name: string } | null;
  summary: string;
};

function defaultRange(): DateRange {
  const to = new Date();
  const from = new Date(); from.setMonth(from.getMonth() - 1);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

const KIND_CLASS: Record<Row['kind'], string> = {
  assignee_change: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  room_move:       'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  weight_log:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  ticket_opened:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  vet_visit:       'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  eating_log:      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  medication_log:  'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
};

const KIND_LABEL: Record<Row['kind'], string> = {
  assignee_change: 'assignee',
  room_move:       'room',
  weight_log:      'weight',
  ticket_opened:   'ticket',
  vet_visit:       'vet',
  eating_log:      'eating',
  medication_log:  'meds'
};

export function ActivityReport() {
  const [range, setRange] = useState<DateRange>(defaultRange());

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ['report-activity', range.from, range.to],
    queryFn: async () => {
      const r = await fetch(`/api/reports/activity?from=${range.from}&to=${range.to}`, { cache: 'no-store' });
      if (!r.ok) return [];
      return (await r.json()).rows;
    }
  });

  function exportCsv() {
    const csv = toCsv(rows, [
      { key: 'at',      header: 'When',    format: (v) => new Date(String(v)).toLocaleString() },
      { key: 'kind',    header: 'Kind' },
      { key: 'cat',     header: 'Cat',     format: (v) => (v as Row['cat'])?.name ?? '' },
      { key: 'actor',   header: 'Actor' },
      { key: 'summary', header: 'Action' }
    ]);
    downloadCsv(`activity-${range.from}-to-${range.to}`, csv);
  }

  return (
    <ReportShell
      title="User activity"
      description="Unified audit feed across all modules — who did what, when."
      defaultRange={range}
      onRangeChange={setRange}
      onExport={exportCsv}
      exportDisabled={rows.length === 0}
    >
      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!isLoading && (
        <ul className="space-y-2">
          {rows.length === 0 && (
            <li className="text-sm text-muted-foreground text-center py-3">No activity.</li>
          )}
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-2 text-sm border-b pb-2 last:border-0">
              <Badge className={`${KIND_CLASS[r.kind]} border-0 text-[10px] uppercase shrink-0`}>
                {KIND_LABEL[r.kind]}
              </Badge>
              <div className="min-w-0 flex-1">
                <div className="truncate">
                  <span className="font-medium">{r.actor ?? '—'}</span>
                  {r.cat && <> · <span className="text-muted-foreground">{r.cat.name}</span></>}
                </div>
                <div className="text-xs text-muted-foreground">{r.summary}</div>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(r.at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ReportShell>
  );
}
