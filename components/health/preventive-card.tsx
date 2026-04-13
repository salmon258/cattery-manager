'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Bug, Plus } from 'lucide-react';

import type { PreventiveTreatment } from '@/lib/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { DueChip, computeDueStatus } from '@/components/health/due-chip';
import { LogPreventiveModal } from '@/components/health/log-preventive-modal';

type Row = PreventiveTreatment & { recorder?: { id: string; full_name: string } | null };

async function fetchPreventive(catId: string): Promise<Row[]> {
  const r = await fetch(`/api/cats/${catId}/preventive`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).treatments;
}

export function PreventiveCard({ catId }: { catId: string }) {
  const t = useTranslations('preventive');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);

  const { data: all = [], isLoading } = useQuery({
    queryKey: ['preventive', catId],
    queryFn: () => fetchPreventive(catId)
  });

  const nextDue = useMemo(() => {
    const withDue = all.filter((v) => v.next_due_date).map((v) => v.next_due_date!).sort();
    return withDue[0] ?? null;
  }, [all]);

  const chipLabels = {
    overdue: t('chip.overdue'),
    dueSoon: t('chip.dueSoon'),
    ok: t('chip.ok'),
    none: t('chip.none'),
    inDays: (n: number) => t('chip.inDays', { n }),
    agoDays: (n: number) => t('chip.agoDays', { n })
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Bug className="h-4 w-4 text-muted-foreground" />
          {t('title')}
        </CardTitle>
        <div className="flex items-center gap-2">
          <DueChip nextDueISO={nextDue} dueSoonDays={14} labels={chipLabels} />
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> {t('log')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{tc('loading')}</p>
        ) : all.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {all.slice(0, 10).map((v) => {
              const due = computeDueStatus(v.next_due_date);
              return (
                <li key={v.id} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0">
                  <div className="min-w-0">
                    <div className="font-medium flex items-center gap-2 flex-wrap">
                      {t(`types.${v.treatment_type}`)}
                      <span className="text-muted-foreground text-xs">· {v.product_name}</span>
                      {due.status === 'overdue' && <Badge variant="destructive">{t('chip.overdue')}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{formatDate(v.administered_date)}</div>
                  </div>
                  {v.next_due_date && (
                    <span className="text-xs whitespace-nowrap text-muted-foreground">
                      {t('nextDue')}: {formatDate(v.next_due_date)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <LogPreventiveModal open={open} onClose={() => setOpen(false)} catId={catId} />
    </Card>
  );
}
