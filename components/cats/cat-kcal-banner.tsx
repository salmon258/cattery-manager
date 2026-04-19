'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Flame, Scale } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type LifeStage =
  | 'kitten_young'
  | 'kitten'
  | 'lactating'
  | 'pregnant'
  | 'spayed'
  | 'adult';

type CalorieSummary = {
  recommended_kcal: number | null;
  today_kcal: number;
  latest_weight_kg: number | null;
  life_stage: LifeStage | null;
  life_stage_multiplier: number | null;
};

const STAGE_STYLES: Record<LifeStage, string> = {
  kitten_young: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800',
  kitten:       'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800',
  lactating:    'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-800',
  pregnant:     'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-900/40 dark:text-fuchsia-200 dark:border-fuchsia-800',
  spayed:       'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/40 dark:text-sky-200 dark:border-sky-800',
  adult:        'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700'
};

async function fetchSummary(catId: string): Promise<CalorieSummary> {
  const r = await fetch(`/api/cats/${catId}/calorie-summary`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return r.json();
}

/**
 * Hero-strip banner that surfaces the spec §3.4.2 "recommended daily kcal"
 * prominently on the cat profile Overview. Intentionally compact — the full
 * EatingCard renders the progress bar + 7-day chart below.
 */
export function CatKcalBanner({ catId }: { catId: string }) {
  const te = useTranslations('eating');
  const tls = useTranslations('cats.lifeStage');

  const { data } = useQuery({
    queryKey: ['calorie-summary', catId],
    queryFn: () => fetchSummary(catId)
  });

  const target = data?.recommended_kcal ?? null;
  const today = data?.today_kcal ?? 0;
  const weight = data?.latest_weight_kg;
  const stage = data?.life_stage ?? null;
  const stageMultiplier = data?.life_stage_multiplier ?? null;
  const progress = target ? Math.min(100, Math.round((today / target) * 100)) : 0;

  const status =
    !target ? 'none' : today / target >= 0.8 ? 'green' : today / target >= 0.5 ? 'amber' : 'red';

  return (
    <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-transparent p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{te('dailyTarget')}</div>
            <div className="text-xl font-semibold">
              {target !== null ? (
                <>
                  {today} <span className="text-sm font-normal text-muted-foreground">/ {target} kcal</span>
                </>
              ) : (
                <span className="text-sm font-normal text-muted-foreground">{te('needWeight')}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stage && (
            <Badge
              variant="outline"
              className={cn('gap-1 border', STAGE_STYLES[stage])}
              title={tls('label')}
            >
              <span>{tls(stage)}</span>
              {stageMultiplier !== null && (
                <span className="font-mono text-[10px] opacity-80">
                  ×{stageMultiplier.toFixed(stageMultiplier % 1 === 0 ? 0 : 1)}
                </span>
              )}
            </Badge>
          )}
          {weight !== null && weight !== undefined && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Scale className="h-3 w-3" /> {weight} kg
            </div>
          )}
        </div>
      </div>
      {target !== null && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full transition-all',
              status === 'red' ? 'bg-destructive' : status === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
