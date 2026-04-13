'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Flame, Scale } from 'lucide-react';

import { cn } from '@/lib/utils';

type CalorieSummary = {
  recommended_kcal: number | null;
  today_kcal: number;
  latest_weight_kg: number | null;
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

  const { data } = useQuery({
    queryKey: ['calorie-summary', catId],
    queryFn: () => fetchSummary(catId)
  });

  const target = data?.recommended_kcal ?? null;
  const today = data?.today_kcal ?? 0;
  const weight = data?.latest_weight_kg;
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
        {weight !== null && weight !== undefined && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Scale className="h-3 w-3" /> {weight} kg
          </div>
        )}
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
