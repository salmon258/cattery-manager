'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Utensils } from 'lucide-react';

import type { EatenRatio, FeedingMethod, UserRole } from '@/lib/supabase/aliases';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EATEN_RATIO_FACTOR } from '@/lib/schemas/eating';
import { CatDetailHeader } from '@/components/cats/detail/cat-detail-header';
import {
  DateRangeFilter,
  defaultLastNDays,
  endOfDayIso,
  startOfDayIso,
  type DateRange
} from '@/components/cats/detail/date-range-filter';
import { DailyKcalChart } from '@/components/cats/detail/daily-kcal-chart';

type EatingLogRow = {
  id: string;
  meal_time: string;
  feeding_method: FeedingMethod;
  notes: string | null;
  submitter?: { id: string; full_name: string } | null;
  items: {
    id: string;
    food_item_id: string;
    estimated_kcal_consumed: number | null;
    quantity_given_g: number;
    quantity_eaten: EatenRatio;
    food?: { name: string } | null;
  }[];
};

type CalorieSummary = {
  recommended_kcal: number | null;
  today_kcal: number;
  last7_days: { date: string; kcal: number }[];
  latest_weight_kg: number | null;
  latest_weight_at: string | null;
};

async function fetchRangeMeals(catId: string, range: DateRange): Promise<EatingLogRow[]> {
  const since = startOfDayIso(new Date(range.from));
  const until = endOfDayIso(new Date(range.to));
  const r = await fetch(
    `/api/cats/${catId}/eating?limit=500&since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`,
    { cache: 'no-store' }
  );
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).logs;
}

async function fetchSummary(catId: string): Promise<CalorieSummary> {
  const r = await fetch(`/api/cats/${catId}/calorie-summary`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return r.json();
}

function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(from);
  const end = new Date(to);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    );
  }
  return out;
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  catId: string;
  catName: string;
  profilePhotoUrl: string | null;
  role: UserRole;
  currentUserId: string;
}

export function EatingDetail({ catId, catName, profilePhotoUrl }: Props) {
  const t = useTranslations('eating');
  const tc = useTranslations('common');
  const td = useTranslations('catDetail');

  const [range, setRange] = useState<DateRange>(defaultLastNDays(30));

  const { data: summary } = useQuery({
    queryKey: ['calorie-summary', catId],
    queryFn: () => fetchSummary(catId)
  });
  const target = summary?.recommended_kcal ?? null;

  const { data: meals = [], isLoading } = useQuery({
    queryKey: ['eating-range', catId, range.from, range.to],
    queryFn: () => fetchRangeMeals(catId, range)
  });

  const { chartDays, totals } = useMemo(() => {
    const all = daysBetween(range.from, range.to);
    const map = new Map<string, number>(all.map((k) => [k, 0]));
    let totalKcal = 0;
    let totalGivenG = 0;
    let totalEatenG = 0;
    for (const m of meals) {
      const k = dayKey(m.meal_time);
      if (!map.has(k)) continue;
      const kcal = m.items.reduce(
        (acc, it) => acc + (Number(it.estimated_kcal_consumed) || 0),
        0
      );
      map.set(k, (map.get(k) ?? 0) + kcal);
      totalKcal += kcal;
      for (const it of m.items) {
        const given = Number(it.quantity_given_g) || 0;
        totalGivenG += given;
        totalEatenG += given * (EATEN_RATIO_FACTOR[it.quantity_eaten] ?? 1);
      }
    }
    return {
      chartDays: Array.from(map.entries()).map(([date, kcal]) => ({
        date,
        kcal: Math.round(kcal)
      })),
      totals: {
        kcal: Math.round(totalKcal),
        givenG: Math.round(totalGivenG),
        eatenG: Math.round(totalEatenG),
        mealCount: meals.length,
        dayCount: all.length
      }
    };
  }, [meals, range.from, range.to]);

  const avgKcal = totals.dayCount > 0 ? Math.round(totals.kcal / totals.dayCount) : 0;

  return (
    <div className="space-y-4">
      <CatDetailHeader
        catId={catId}
        catName={catName}
        profilePhotoUrl={profilePhotoUrl}
        subtitle={t('title')}
      />

      <Card className="border-l-4 border-l-amber-400">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Utensils className="h-4 w-4 text-amber-500" />
            {td('dailyKcalOverRange')}
          </CardTitle>
          <DateRangeFilter
            value={range}
            onChange={setRange}
            presets={[
              { label: '7d', days: 7 },
              { label: '30d', days: 30 },
              { label: '90d', days: 90 }
            ]}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Stat label={td('totalKcal')} value={totals.kcal.toLocaleString()} />
            <Stat label={td('avgKcalPerDay')} value={avgKcal.toLocaleString()} />
            <Stat
              label={td('target')}
              value={target != null ? target.toLocaleString() : '—'}
            />
            <Stat label={td('meals')} value={totals.mealCount.toLocaleString()} />
          </div>
          <DailyKcalChart days={chartDays} target={target} height={280} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{td('mealsInRange')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{tc('loading')}</p>
          ) : meals.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noMeals')}</p>
          ) : (
            <ul className="divide-y text-sm">
              {meals.map((m) => {
                const kcal = m.items.reduce(
                  (acc, it) => acc + (Number(it.estimated_kcal_consumed) || 0),
                  0
                );
                const given = m.items.reduce(
                  (acc, it) => acc + (Number(it.quantity_given_g) || 0),
                  0
                );
                const eaten = m.items.reduce(
                  (acc, it) =>
                    acc +
                    (Number(it.quantity_given_g) || 0) *
                      (EATEN_RATIO_FACTOR[it.quantity_eaten] ?? 1),
                  0
                );
                return (
                  <li key={m.id} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {m.items.map((it) => it.food?.name).filter(Boolean).join(', ') || '—'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(m.meal_time).toLocaleString()} ·{' '}
                        {t(`methods.${m.feeding_method}`)}
                        {m.submitter?.full_name ? ` · ${m.submitter.full_name}` : ''}
                      </div>
                      {m.notes && (
                        <p className="mt-0.5 text-xs italic text-muted-foreground whitespace-pre-wrap">
                          {m.notes}
                        </p>
                      )}
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <div className="text-xs font-medium">
                        {Math.round(eaten)}/{Math.round(given)} g
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {Math.round(kcal)} kcal
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold leading-tight">{value}</div>
    </div>
  );
}
