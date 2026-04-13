'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus, Utensils } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LogEatingModal } from '@/components/eating/log-eating-modal';

type CalorieSummary = {
  recommended_kcal: number | null;
  today_kcal: number;
  last7_days: { date: string; kcal: number }[];
  latest_weight_kg: number | null;
  latest_weight_at: string | null;
};

async function fetchSummary(catId: string): Promise<CalorieSummary> {
  const r = await fetch(`/api/cats/${catId}/calorie-summary`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return r.json();
}

type EatingLogRow = {
  id: string;
  meal_time: string;
  feeding_method: 'self' | 'assisted' | 'force_fed';
  submitter?: { full_name: string } | null;
  items: {
    estimated_kcal_consumed: number | null;
    quantity_given_g: number;
    quantity_eaten: string;
    food?: { name: string } | null;
  }[];
};

async function fetchMeals(catId: string): Promise<EatingLogRow[]> {
  const r = await fetch(`/api/cats/${catId}/eating?limit=10`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).logs;
}

export function EatingCard({ catId }: { catId: string }) {
  const t = useTranslations('eating');
  const [open, setOpen] = useState(false);

  const { data: summary } = useQuery({
    queryKey: ['calorie-summary', catId],
    queryFn: () => fetchSummary(catId)
  });
  const { data: meals = [] } = useQuery({
    queryKey: ['eating', catId],
    queryFn: () => fetchMeals(catId)
  });

  const today = summary?.today_kcal ?? 0;
  const target = summary?.recommended_kcal ?? null;
  const progress = target ? Math.min(100, Math.round((today / target) * 100)) : 0;

  // Status mapping per spec:
  // green (on track), amber (>20% under), red (>50% under OR any force-fed meal today)
  const forceFedToday = meals.some(
    (m) => m.feeding_method === 'force_fed' && isToday(m.meal_time)
  );
  const shortfall = target ? (target - today) / target : 0;
  const status: 'green' | 'amber' | 'red' | 'none' = !target
    ? 'none'
    : forceFedToday || shortfall > 0.5
      ? 'red'
      : shortfall > 0.2
        ? 'amber'
        : 'green';

  return (
    <Card className="overflow-hidden border-l-4 border-l-amber-400 bg-gradient-to-r from-amber-50/50 to-transparent dark:from-amber-950/20">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Utensils className="h-4 w-4 text-amber-500" />
          {t('title')}
        </CardTitle>
        <Button
          size="sm"
          onClick={() => setOpen(true)}
          className="bg-amber-500 text-white shadow hover:bg-amber-600"
        >
          <Plus className="h-4 w-4" /> {t('log')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {target === null ? (
          <p className="text-sm text-muted-foreground">{t('needWeight')}</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-semibold tracking-tight">
                {today} <span className="text-sm font-normal text-muted-foreground">/ {target} kcal</span>
              </div>
              <Badge variant={status === 'red' ? 'destructive' : 'secondary'} className="capitalize">
                {t(`status.${status}`)}
              </Badge>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full transition-all',
                  status === 'red' ? 'bg-destructive' : status === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'
                )}
                style={{ width: `${progress}%` }}
              />
            </div>

            {summary && summary.last7_days.length > 0 && (
              <Last7DaysBars days={summary.last7_days} target={target} />
            )}
          </>
        )}

        <div>
          <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{t('recent')}</div>
          {meals.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noMeals')}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {meals.slice(0, 5).map((m) => {
                const total = m.items.reduce(
                  (acc, it) => acc + (Number(it.estimated_kcal_consumed) || 0),
                  0
                );
                return (
                  <li
                    key={m.id}
                    className="flex items-center justify-between border-b py-1 last:border-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate">
                        {m.items.map((it) => it.food?.name).filter(Boolean).join(', ') || '—'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(m.meal_time).toLocaleString()} · {t(`methods.${m.feeding_method}`)}
                      </div>
                    </div>
                    <span className="ml-2 whitespace-nowrap text-xs font-medium">{Math.round(total)} kcal</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>

      <LogEatingModal open={open} onClose={() => setOpen(false)} catId={catId} />
    </Card>
  );
}

function Last7DaysBars({
  days,
  target
}: {
  days: { date: string; kcal: number }[];
  target: number;
}) {
  const max = Math.max(target, ...days.map((d) => d.kcal), 1);
  return (
    <div>
      <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Last 7 days</div>
      <div className="flex items-end gap-1 h-16">
        {days.map((d) => {
          const h = Math.round((d.kcal / max) * 100);
          const pctOfTarget = d.kcal / target;
          const color =
            pctOfTarget >= 0.8
              ? 'bg-emerald-500'
              : pctOfTarget >= 0.5
                ? 'bg-amber-500'
                : pctOfTarget > 0
                  ? 'bg-destructive/60'
                  : 'bg-muted';
          return (
            <div
              key={d.date}
              className="flex flex-1 flex-col items-center gap-1"
              title={`${d.date}: ${d.kcal} kcal`}
            >
              <div
                className={cn('w-full rounded-t-sm transition-all', color)}
                style={{ height: `${h}%` }}
              />
              <span className="text-[9px] text-muted-foreground">
                {d.date.slice(5).replace('-', '/')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
