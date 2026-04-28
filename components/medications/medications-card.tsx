'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowRight, Check, Pause, Pencil, Pill, Play, Plus, Sparkles, Timer, Trash2 } from 'lucide-react';

import type { Medication, MedicationTask } from '@/lib/supabase/aliases';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import { NewMedicationModal } from '@/components/medications/new-medication-modal';
import { EditMedicationModal } from '@/components/medications/edit-medication-modal';
import { LogAdHocMedModal } from '@/components/medications/log-ad-hoc-med-modal';
import { SuggestMedicationModal } from '@/components/medications/suggest-medication-modal';

type TaskRow = MedicationTask & { medication: Pick<Medication, 'id' | 'medicine_name' | 'dose' | 'route'> };

async function fetchMedications(catId: string): Promise<Medication[]> {
  const r = await fetch(`/api/cats/${catId}/medications?include_inactive=1`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).medications;
}

async function fetchUpcomingTasks(catId: string): Promise<TaskRow[]> {
  // Fetch today's + tomorrow's tasks for this specific cat via the me/tasks
  // endpoint with scope=all filtered client-side (admin-friendly).
  const r = await fetch(`/api/me/tasks?scope=all`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  const { tasks } = (await r.json()) as { tasks: (TaskRow & { cat: { id: string } })[] };
  return tasks.filter((t) => t.cat?.id === catId);
}

export function MedicationsCard({ catId }: { catId: string }) {
  const t = useTranslations('medications');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const [newOpen, setNewOpen] = useState(false);
  const [adHocOpen, setAdHocOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);

  const { data: meds = [], isLoading } = useQuery({
    queryKey: ['medications', catId],
    queryFn: () => fetchMedications(catId)
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ['medication-tasks', catId],
    queryFn: () => fetchUpcomingTasks(catId)
  });

  const visibleMeds = useMemo(
    () =>
      [...meds].sort((a, b) => {
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
        return a.medicine_name.localeCompare(b.medicine_name);
      }),
    [meds]
  );

  const confirm = useMutation({
    mutationFn: async (taskId: string) => {
      const r = await fetch(`/api/tasks/${taskId}/confirm`, { method: 'POST' });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('taskConfirmed'));
      qc.invalidateQueries({ queryKey: ['medication-tasks', catId] });
      qc.invalidateQueries({ queryKey: ['me-tasks'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const pauseMed = useMutation({
    mutationFn: async (medId: string) => {
      const r = await fetch(`/api/medications/${medId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ is_active: false })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('paused'));
      qc.invalidateQueries({ queryKey: ['medications', catId] });
      qc.invalidateQueries({ queryKey: ['medication-tasks', catId] });
      qc.invalidateQueries({ queryKey: ['me-tasks'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const continueMed = useMutation({
    mutationFn: async (medId: string) => {
      const r = await fetch(`/api/medications/${medId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ is_active: true })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('resumed'));
      qc.invalidateQueries({ queryKey: ['medications', catId] });
      qc.invalidateQueries({ queryKey: ['medication-tasks', catId] });
      qc.invalidateQueries({ queryKey: ['me-tasks'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const stopMed = useMutation({
    mutationFn: async (medId: string) => {
      const r = await fetch(`/api/medications/${medId}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('stopped'));
      qc.invalidateQueries({ queryKey: ['medications', catId] });
      qc.invalidateQueries({ queryKey: ['medication-tasks', catId] });
      qc.invalidateQueries({ queryKey: ['me-tasks'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const r = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('taskDeleted'));
      qc.invalidateQueries({ queryKey: ['medication-tasks', catId] });
      qc.invalidateQueries({ queryKey: ['me-tasks'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  return (
    <Card className="overflow-hidden border-l-4 border-l-violet-400 bg-gradient-to-r from-violet-50/50 to-transparent dark:from-violet-950/20 md:col-span-2">
      <CardHeader className="flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Pill className="h-4 w-4 text-violet-500" />
          {t('title')}
        </CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/cats/${catId}/medications`}
            className="text-xs text-violet-700 hover:text-violet-800 dark:text-violet-300 dark:hover:text-violet-200 inline-flex items-center gap-0.5"
          >
            {tc('viewDetails')} <ArrowRight className="h-3 w-3" />
          </Link>
          <Button
            size="sm"
            onClick={() => setAdHocOpen(true)}
            className="bg-violet-500 text-white shadow hover:bg-violet-600"
          >
            <Plus className="h-4 w-4" /> {t('adHoc.log')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40"
            onClick={() => setSuggestOpen(true)}
          >
            <Sparkles className="h-4 w-4" /> {t('suggestFromSickness')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40"
            onClick={() => setNewOpen(true)}
          >
            <Plus className="h-4 w-4" /> {t('newSchedule')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Today's / overdue tasks */}
        <section>
          <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Timer className="h-3 w-3" /> {t('todayTasks')}
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noTasksToday')}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {tasks.map((task) => {
                const overdue = new Date(task.due_at) < new Date();
                return (
                  <li
                    key={task.id}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-md border p-2',
                      overdue && 'border-destructive/40 bg-destructive/5'
                    )}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        {task.medication.medicine_name}
                        <span className="text-xs text-muted-foreground">· {task.medication.dose}</span>
                        {overdue && <Badge variant="destructive">{t('overdue')}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(task.due_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        disabled={confirm.isPending}
                        onClick={() => confirm.mutate(task.id)}
                        className="bg-emerald-500 text-white shadow hover:bg-emerald-600"
                      >
                        <Check className="h-3.5 w-3.5" /> {t('confirm')}
                      </Button>
                      {overdue && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={deleteTask.isPending}
                          onClick={() => {
                            if (window.confirm(t('confirmDeleteTask'))) deleteTask.mutate(task.id);
                          }}
                          aria-label={t('deleteTask')}
                          title={t('deleteTask')}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Schedules */}
        <section>
          <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
            {t('activeSchedules')}
          </div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{tc('loading')}</p>
          ) : visibleMeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noSchedules')}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {visibleMeds.map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    'flex items-center justify-between gap-2 border-b pb-1 last:border-0 group',
                    !m.is_active && 'opacity-60'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate flex items-center gap-2 flex-wrap">
                      <span className="truncate">{m.medicine_name}</span>
                      <span className="text-xs text-muted-foreground">· {m.dose}</span>
                      {!m.is_active && <Badge variant="secondary">{t('pausedBadge')}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(m.start_date)} → {m.end_date ? formatDate(m.end_date) : t('ongoing')} ·{' '}
                      {t(`routes.${m.route}`)} · {t('intervalLabel', { n: m.interval_days })} ·{' '}
                      {m.time_slots.join(', ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setEditing(m)}
                      aria-label={tc('edit')}
                      title={tc('edit')}
                    >
                      <Pencil className="h-3.5 w-3.5 text-sky-600" />
                    </Button>
                    {m.is_active ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={pauseMed.isPending}
                        onClick={() => {
                          if (window.confirm(t('confirmPause'))) pauseMed.mutate(m.id);
                        }}
                        aria-label={t('pause')}
                        title={t('pause')}
                      >
                        <Pause className="h-3.5 w-3.5 text-amber-600" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={continueMed.isPending}
                        onClick={() => {
                          if (window.confirm(t('confirmContinue'))) continueMed.mutate(m.id);
                        }}
                        aria-label={t('continue')}
                        title={t('continue')}
                      >
                        <Play className="h-3.5 w-3.5 text-emerald-600" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={stopMed.isPending}
                      onClick={() => {
                        if (window.confirm(t('confirmStop'))) stopMed.mutate(m.id);
                      }}
                      aria-label={t('stop')}
                      title={t('stop')}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>

      <NewMedicationModal open={newOpen} onClose={() => setNewOpen(false)} catId={catId} />
      <EditMedicationModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        catId={catId}
        medication={editing}
      />
      <LogAdHocMedModal open={adHocOpen} onClose={() => setAdHocOpen(false)} catId={catId} />
      <SuggestMedicationModal open={suggestOpen} onClose={() => setSuggestOpen(false)} catId={catId} />
    </Card>
  );
}
