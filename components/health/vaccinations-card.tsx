'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus, Syringe } from 'lucide-react';

import type { Vaccination } from '@/lib/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { DueChip, computeDueStatus } from '@/components/health/due-chip';
import { LogVaccinationModal } from '@/components/health/log-vaccination-modal';

type VaccinationRow = Vaccination & { recorder?: { id: string; full_name: string } | null };

async function fetchVaccinations(catId: string): Promise<VaccinationRow[]> {
  const r = await fetch(`/api/cats/${catId}/vaccinations`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).vaccinations;
}

export function VaccinationsCard({ catId }: { catId: string }) {
  const t = useTranslations('vaccines');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);

  const { data: all = [], isLoading } = useQuery({
    queryKey: ['vaccinations', catId],
    queryFn: () => fetchVaccinations(catId)
  });

  // Earliest next_due_date across all entries with a due date → drives the chip.
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
          <Syringe className="h-4 w-4 text-muted-foreground" />
          {t('title')}
        </CardTitle>
        <div className="flex items-center gap-2">
          <DueChip nextDueISO={nextDue} labels={chipLabels} />
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
                      {t(`types.${v.vaccine_type}`)}
                      {v.vaccine_name && <span className="text-muted-foreground text-xs">· {v.vaccine_name}</span>}
                      {due.status === 'overdue' && <Badge variant="destructive">{t('chip.overdue')}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(v.administered_date)} · {v.administered_by_vet ?? '—'}
                      {v.batch_number ? ` · #${v.batch_number}` : ''}
                    </div>
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

      <LogVaccinationModal open={open} onClose={() => setOpen(false)} catId={catId} />
    </Card>
  );
}
