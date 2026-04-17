'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2, Utensils } from 'lucide-react';

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
              <ul className="space-y-1 text-sm">
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
                  return (
                    <li
                      key={m.id}
                      className="group flex items-center justify-between gap-2 border-b py-1 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate">
                          {m.items.map((it) => it.food?.name).filter(Boolean).join(', ') || '—'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(m.meal_time).toLocaleString()} · {t(`methods.${m.feeding_method}`)}
                        </div>
                      </div>
                      <span className="ml-2 whitespace-nowrap text-xs font-medium text-right">
                        {Math.round(eatenGrams)}/{Math.round(grams)} g
                        <span className="block text-muted-foreground font-normal">
                          {Math.round(total)} kcal
                        </span>
                      </span>
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
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        <span>Last 7 days · kcal</span>
        {target != null && <span className="normal-case">target {target}</span>}
      </div>
      <div className="relative flex items-end gap-1 h-20">
        {target != null && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-emerald-400/60"
            style={{ bottom: `${Math.round((target / max) * 100)}%` }}
            title={`Target: ${target} kcal`}
          />
        )}
        {days.map((d) => {
          const h = Math.round((d.kcal / max) * 100);
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
              className="flex flex-1 flex-col items-center gap-1"
              title={`${d.date}: ${d.kcal} kcal`}
            >
              <span className="text-[9px] text-muted-foreground leading-none">
                {d.kcal > 0 && d.kcal >= peak * 0.1 ? d.kcal : ''}
              </span>
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
