'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowRight, Pencil, Plus, Trash2, Utensils } from 'lucide-react';

import type { EatenRatio, FeedingMethod, UserRole } from '@/lib/supabase/aliases';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { EATEN_RATIO_FACTOR } from '@/lib/schemas/eating';
import { LogEatingModal, type EditableEatingLog } from '@/components/eating/log-eating-modal';

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
  feeding_method: FeedingMethod;
  notes: string | null;
  submitted_by: string;
  submitter?: { full_name: string } | null;
  items: {
    id: string;
    food_item_id: string;
    estimated_kcal_consumed: number | null;
    quantity_given_g: number;
    quantity_eaten: EatenRatio;
    food?: { name: string } | null;
  }[];
};

async function fetchMeals(catId: string, limit: number): Promise<EatingLogRow[]> {
  const r = await fetch(`/api/cats/${catId}/eating?limit=${limit}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).logs;
}

const INITIAL_MEALS = 5;
const EXPANDED_MEALS = 50;

interface Props {
  catId: string;
  role: UserRole;
  currentUserId: string;
}

export function EatingCard({ catId, role, currentUserId }: Props) {
  const t = useTranslations('eating');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const isAdmin = role === 'admin';

  const [open, setOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<EditableEatingLog | null>(null);
  const [showAllMeals, setShowAllMeals] = useState(false);

  const { data: summary } = useQuery({
    queryKey: ['calorie-summary', catId],
    queryFn: () => fetchSummary(catId)
  });
  const mealLimit = showAllMeals ? EXPANDED_MEALS : INITIAL_MEALS;
  const { data: meals = [] } = useQuery({
    queryKey: ['eating', catId, mealLimit],
    queryFn: () => fetchMeals(catId, mealLimit)
  });

  const deleteMeal = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/eating-logs/${id}`, { method: 'DELETE' });
      if (!r.ok && r.status !== 204) {
        throw new Error((await r.json().catch(() => ({}))).error ?? 'Failed');
      }
    },
    onSuccess: () => {
      toast.success(t('deleted'));
      // Same invalidation set the log-meal mutation uses — keeps the card,
      // banner, and dashboard tracker in sync without a hard refresh.
      qc.invalidateQueries({ queryKey: ['eating', catId] });
      qc.invalidateQueries({ queryKey: ['calorie-summary', catId] });
      qc.invalidateQueries({ queryKey: ['me-cats'] });
      qc.invalidateQueries({ queryKey: ['daily-progress'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  function canEdit(log: EatingLogRow) {
    return isAdmin || log.submitted_by === currentUserId;
  }

  function startEdit(log: EatingLogRow) {
    setEditingLog({
      id: log.id,
      feeding_method: log.feeding_method,
      notes: log.notes,
      items: log.items.map((it) => ({
        food_item_id: it.food_item_id,
        quantity_given_g: it.quantity_given_g,
        quantity_eaten: it.quantity_eaten
      }))
    });
  }

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
        <div className="flex items-center gap-2">
          <Link
            href={`/cats/${catId}/eating`}
            className="text-xs text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200 inline-flex items-center gap-0.5"
          >
            {tc('viewDetails')} <ArrowRight className="h-3 w-3" />
          </Link>
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            className="bg-amber-500 text-white shadow hover:bg-amber-600"
          >
            <Plus className="h-4 w-4" /> {t('log')}
          </Button>
        </div>
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

          </>
        )}

        {summary && summary.last7_days.length > 0 && (
          <Last7DaysBars days={summary.last7_days} target={target ?? null} />
        )}

        <div>
          <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{t('recent')}</div>
          {meals.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noMeals')}</p>
          ) : (
            <>
              <ul className="space-y-2 text-sm">
                {meals.map((m) => {
                  const total = m.items.reduce(
                    (acc, it) => acc + (Number(it.estimated_kcal_consumed) || 0),
                    0
                  );
                  const grams = m.items.reduce(
                    (acc, it) => acc + (Number(it.quantity_given_g) || 0),
                    0
                  );
                  const eatenGrams = m.items.reduce(
                    (acc, it) =>
                      acc +
                      (Number(it.quantity_given_g) || 0) *
                        (EATEN_RATIO_FACTOR[it.quantity_eaten] ?? 1),
                    0
                  );
                  const editable = canEdit(m);
                  const showTotals = m.items.length > 1;
                  return (
                    <li
                      key={m.id}
                      className="group border-b pb-2 last:border-0 last:pb-0"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                          {new Date(m.meal_time).toLocaleString()} · {t(`methods.${m.feeding_method}`)}
                        </div>
                        {showTotals && (
                          <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                            {Math.round(eatenGrams)}/{Math.round(grams)} g · {Math.round(total)} kcal
                          </span>
                        )}
                        {editable && (
                          <div className="flex items-center gap-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                            <button
                              type="button"
                              onClick={() => startEdit(m)}
                              className="p-0.5 text-muted-foreground hover:text-foreground"
                              aria-label={tc('edit')}
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(t('confirmDelete'))) deleteMeal.mutate(m.id);
                              }}
                              className="p-0.5 text-muted-foreground hover:text-destructive"
                              aria-label={tc('delete')}
                              disabled={deleteMeal.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      <ul className="mt-1 space-y-0.5">
                        {m.items.map((it) => {
                          const given = Number(it.quantity_given_g) || 0;
                          const eaten = given * (EATEN_RATIO_FACTOR[it.quantity_eaten] ?? 1);
                          const kcal = Number(it.estimated_kcal_consumed) || 0;
                          const disp = ratioDisplay(it.quantity_eaten);
                          return (
                            <li key={it.id} className="flex items-center justify-between gap-2">
                              <span className="min-w-0 truncate font-medium">
                                {it.food?.name || '—'}
                              </span>
                              <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                                <span>
                                  {Math.round(eaten)}/{Math.round(given)} g · {Math.round(kcal)} kcal
                                </span>
                                <span className={cn('rounded px-1 py-0.5 text-[10px] font-medium', disp.cls)}>
                                  {disp.label}
                                </span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                })}
              </ul>
              {(!showAllMeals && meals.length >= INITIAL_MEALS) ||
              (showAllMeals && meals.length > INITIAL_MEALS) ? (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAllMeals((v) => !v)}
                    className="text-xs text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
                  >
                    {showAllMeals ? t('showLess') : t('showMore')}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </CardContent>

      <LogEatingModal open={open} onClose={() => setOpen(false)} catId={catId} />
      <LogEatingModal
        open={!!editingLog}
        onClose={() => setEditingLog(null)}
        catId={catId}
        editLog={editingLog}
      />
    </Card>
  );
}

function Last7DaysBars({
  days,
  target
}: {
  days: { date: string; kcal: number }[];
  target: number | null;
}) {
  const max = Math.max(target ?? 0, ...days.map((d) => d.kcal), 1);
  const peak = Math.max(...days.map((d) => d.kcal), 1);
  // Rounded Y-axis ticks (0, mid, top). Nice-round max so labels read cleanly.
  const yMax = niceCeil(max);
  const ticks = [0, Math.round(yMax / 2), yMax];
  const PLOT_H = 96;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        <span>Last 7 days · kcal</span>
        {target != null && <span className="normal-case">target {target}</span>}
      </div>
      <div className="flex gap-2">
        <div
          className="relative flex flex-col justify-between text-[9px] text-muted-foreground shrink-0"
          style={{ height: PLOT_H, width: 28 }}
          aria-hidden
        >
          {ticks
            .slice()
            .reverse()
            .map((v) => (
              <span key={v} className="leading-none text-right">
                {v}
              </span>
            ))}
        </div>
        <div className="flex-1">
          <div
            className="relative flex items-end gap-1 border-l border-b border-muted-foreground/20"
            style={{ height: PLOT_H }}
          >
            {target != null && target <= yMax && (
              <div
                aria-hidden
                className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-emerald-400/60"
                style={{ bottom: `${(target / yMax) * 100}%` }}
                title={`Target: ${target} kcal`}
              />
            )}
            {days.map((d) => {
              const h = (d.kcal / yMax) * 100;
              const color = target
                ? d.kcal / target >= 0.8
                  ? 'bg-emerald-500'
                  : d.kcal / target >= 0.5
                    ? 'bg-amber-500'
                    : d.kcal > 0
                      ? 'bg-destructive/60'
                      : 'bg-muted'
                : d.kcal > 0
                  ? 'bg-amber-500'
                  : 'bg-muted';
              return (
                <div
                  key={d.date}
                  className="relative flex-1 h-full flex flex-col justify-end items-center"
                  title={`${d.date}: ${d.kcal} kcal`}
                >
                  {d.kcal > 0 && d.kcal >= peak * 0.1 && (
                    <span
                      className="absolute text-[9px] text-muted-foreground leading-none"
                      style={{ bottom: `calc(${h}% + 2px)` }}
                    >
                      {d.kcal}
                    </span>
                  )}
                  <div
                    className={cn('w-full rounded-t-sm transition-all', color)}
                    style={{ height: `${h}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex gap-1">
            {days.map((d) => (
              <span
                key={d.date}
                className="flex-1 text-center text-[9px] text-muted-foreground"
              >
                {d.date.slice(5).replace('-', '/')}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Round 470 → 500, 1234 → 1500, etc. — keeps y-axis labels readable.
function niceCeil(n: number): number {
  if (n <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const f = n / pow;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * pow;
}

function ratioDisplay(r: EatenRatio): { label: string; cls: string } {
  switch (r) {
    case 'all':    return { label: '100%', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' };
    case 'most':   return { label: '~75%', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' };
    case 'half':   return { label: '~50%', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
    case 'little': return { label: '~20%', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' };
    case 'none':   return { label: '0%',   cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
  }
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
