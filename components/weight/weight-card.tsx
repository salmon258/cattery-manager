'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus, Scale } from 'lucide-react';

import type { WeightLog } from '@/lib/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogWeightModal } from '@/components/weight/log-weight-modal';
import { WeightSparkline } from '@/components/weight/weight-sparkline';
import { formatDate } from '@/lib/utils';

type WeightLogRow = WeightLog & { submitter?: { id: string; full_name: string } | null };

async function fetchWeightLogs(catId: string): Promise<WeightLogRow[]> {
  const r = await fetch(`/api/cats/${catId}/weight?limit=50`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).logs;
}

export function WeightCard({ catId }: { catId: string }) {
  const t = useTranslations('weight');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['weight', catId],
    queryFn: () => fetchWeightLogs(catId)
  });

  const latest = logs[0];
  const ascending = [...logs].reverse(); // chart expects oldest-first
  const prev = logs[1];
  const delta = latest && prev ? latest.weight_kg - prev.weight_kg : null;
  const deltaPct = latest && prev && prev.weight_kg > 0
    ? ((latest.weight_kg - prev.weight_kg) / prev.weight_kg) * 100
    : null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="h-4 w-4 text-muted-foreground" />
          {t('title')}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> {t('log')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{tc('loading')}</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('emptyHint')}</p>
        ) : (
          <>
            <div className="flex items-baseline gap-3">
              <div className="text-3xl font-semibold tracking-tight">
                {latest!.weight_kg} <span className="text-base font-normal text-muted-foreground">kg</span>
              </div>
              {delta !== null && (
                <span
                  className={
                    'text-xs ' +
                    (Math.abs(deltaPct ?? 0) >= 10
                      ? 'text-destructive'
                      : delta > 0
                        ? 'text-emerald-600'
                        : delta < 0
                          ? 'text-amber-600'
                          : 'text-muted-foreground')
                  }
                >
                  {delta > 0 ? '+' : ''}
                  {delta.toFixed(2)} kg
                  {deltaPct !== null && ` (${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%)`}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {t('lastRecorded')}: {formatDate(latest!.recorded_at)}
            </div>
            {ascending.length >= 2 && (
              <WeightSparkline points={ascending.map((p) => ({ weight_kg: p.weight_kg, recorded_at: p.recorded_at }))} />
            )}
            <ul className="max-h-40 overflow-y-auto space-y-1 text-sm">
              {logs.slice(0, 10).map((l) => (
                <li key={l.id} className="flex items-center justify-between border-b py-1 last:border-0">
                  <span className="font-medium">{l.weight_kg} kg</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(l.recorded_at)} · {l.submitter?.full_name ?? '—'}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>

      <LogWeightModal open={open} onClose={() => setOpen(false)} catId={catId} />
    </Card>
  );
}
