'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { AlertCircle, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { computeDueStatus, DueChip } from '@/components/health/due-chip';
import { downloadCsv, toCsv } from '@/lib/export/csv';
import { formatDate } from '@/lib/utils';

type CareType = 'vaccination' | 'flea' | 'deworming';

type Row = {
  cat_id: string;
  cat_name: string;
  last_administered: string | null;
  next_due_date: string | null;
};

const TYPES: CareType[] = ['vaccination', 'flea', 'deworming'];

export function CareDueReport() {
  const t = useTranslations('reports.careDue');
  const tv = useTranslations('vaccines');
  const [type, setType] = useState<CareType>('vaccination');

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ['report-care-due', type],
    queryFn: async () => {
      const r = await fetch(`/api/reports/care-due?type=${type}`, { cache: 'no-store' });
      if (!r.ok) return [];
      return (await r.json()).rows;
    }
  });

  const chipLabels = {
    overdue: tv('chip.overdue'),
    dueSoon: tv('chip.dueSoon'),
    ok: tv('chip.ok'),
    none: t('never'),
    inDays: (n: number) => tv('chip.inDays', { n }),
    agoDays: (n: number) => tv('chip.agoDays', { n })
  };

  // Sort: overdue first, then due-soon, then never (no record), then ok.
  // Within each bucket, sort by next_due_date ascending so the most urgent
  // rises to the top.
  const sortedRows = useMemo(() => {
    const order = (r: Row) => {
      if (!r.last_administered) return 2; // never
      const s = computeDueStatus(r.next_due_date).status;
      if (s === 'overdue')   return 0;
      if (s === 'due-soon') return 1;
      if (s === 'ok')        return 3;
      return 4; // 'none' — has been administered but no next_due_date
    };
    return [...rows].sort((a, b) => {
      const oa = order(a);
      const ob = order(b);
      if (oa !== ob) return oa - ob;
      const da = a.next_due_date ?? '9999-12-31';
      const db = b.next_due_date ?? '9999-12-31';
      return da.localeCompare(db);
    });
  }, [rows]);

  const overdueCount = sortedRows.filter((r) => {
    if (!r.last_administered) return true; // never administered counts as needing attention
    return computeDueStatus(r.next_due_date).status === 'overdue';
  }).length;

  function exportCsv() {
    const csv = toCsv(sortedRows, [
      { key: 'cat_name',          header: 'Cat' },
      { key: 'last_administered', header: 'Last administered', format: (v) => v ? formatDate(String(v)) : '' },
      { key: 'next_due_date',     header: 'Next due',          format: (v) => v ? formatDate(String(v)) : '' }
    ]);
    downloadCsv(`care-due-${type}-${new Date().toISOString().slice(0, 10)}`, csv);
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base">{t('title')}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{t('description')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={type} onValueChange={(v) => setType(v as CareType)}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((ty) => (
                  <SelectItem key={ty} value={ty}>{t(`types.${ty}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={sortedRows.length === 0}>
              <Download className="h-4 w-4" /> CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">{t('loading')}</p>}
        {!isLoading && (
          <>
            {overdueCount > 0 && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2 mb-3 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
                <AlertCircle className="h-4 w-4" />
                {t('overdueAlert', { count: overdueCount })}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase border-b">
                  <tr>
                    <th className="text-left py-2 pr-3">{t('columns.cat')}</th>
                    <th className="text-left py-2 pr-3">{t('columns.lastAdministered')}</th>
                    <th className="text-left py-2 pr-3">{t('columns.nextDue')}</th>
                    <th className="text-left py-2 pr-3">{t('columns.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.length === 0 && (
                    <tr><td colSpan={4} className="py-3 text-center text-muted-foreground">{t('empty')}</td></tr>
                  )}
                  {sortedRows.map((r) => {
                    const isOverdue = r.last_administered
                      ? computeDueStatus(r.next_due_date).status === 'overdue'
                      : true;
                    return (
                      <tr
                        key={r.cat_id}
                        className={'border-b last:border-0 ' + (isOverdue ? 'bg-red-50/50 dark:bg-red-900/10' : '')}
                      >
                        <td className="py-2 pr-3 font-medium">{r.cat_name}</td>
                        <td className="py-2 pr-3">
                          {r.last_administered ? formatDate(r.last_administered) : (
                            <span className="text-muted-foreground italic">{t('never')}</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {r.next_due_date ? formatDate(r.next_due_date) : '—'}
                        </td>
                        <td className="py-2 pr-3">
                          <DueChip nextDueISO={r.next_due_date} labels={chipLabels} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
