'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Check, Pill, Plus, Timer, StopCircle, Trash2 } from 'lucide-react';

import type { Medication, MedicationTask, UserRole } from '@/lib/supabase/aliases';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import { NewMedicationModal } from '@/components/medications/new-medication-modal';
import { LogAdHocMedModal } from '@/components/medications/log-ad-hoc-med-modal';

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

export function MedicationsCard({ catId, role }: { catId: string; role: UserRole }) {
  const t = useTranslations('medications');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const isAdmin = role === 'admin';

  const [newOpen, setNewOpen] = useState(false);
  const [adHocOpen, setAdHocOpen] = useState(false);

  const { data: meds = [], isLoading } = useQuery({
    queryKey: ['medications', catId],
    queryFn: () => fetchMedications(catId)
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ['medication-tasks', catId],
    queryFn: () => fetchUpcomingTasks(catId)
  });

  const activeMeds = useMemo(() => meds.filter((m) => m.is_active), [meds]);

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

  const stopMed = useMutation({
    mutationFn: async (medId: string) => {
      const r = await fetch(`/api/medications/${medId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ is_active: false })
      });
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

  const deleteMed = useMutation({
    mutationFn: async (medId: string) => {
      const r = await fetch(`/api/medications/${medId}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('deleted'));
      qc.invalidateQueries({ queryKey: ['medications', catId] });
      qc.invalidateQueries({ queryKey: ['medication-tasks', catId] });
      qc.invalidateQueries({ queryKey: ['me-tasks'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Pill className="h-4 w-4 text-muted-foreground" />
          {t('title')}
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setAdHocOpen(true)}>
            <Plus className="h-4 w-4" /> {t('adHoc.log')}
          </Button>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4" /> {t('newSchedule')}
            </Button>
          )}
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
                    <Button
                      size="sm"
                      variant="default"
                      disabled={confirm.isPending}
                      onClick={() => confirm.mutate(task.id)}
                    >
                      <Check className="h-3.5 w-3.5" /> {t('confirm')}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Active schedules */}
        <section>
          <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
            {t('activeSchedules')}
          </div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{tc('loading')}</p>
          ) : activeMeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noSchedules')}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {activeMeds.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 border-b pb-1 last:border-0 group">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">
                      {m.medicine_name}
                      <span className="text-xs text-muted-foreground"> · {m.dose}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(m.start_date)} → {formatDate(m.end_date)} ·{' '}
                      {t(`routes.${m.route}`)} · {t('intervalLabel', { n: m.interval_days })} ·{' '}
                      {m.time_slots.join(', ')}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
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
                        <StopCircle className="h-3.5 w-3.5 text-amber-600" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={deleteMed.isPending}
                        onClick={() => {
                          if (window.confirm(t('confirmDelete'))) deleteMed.mutate(m.id);
                        }}
                        aria-label={tc('delete')}
                        title={tc('delete')}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>

      {isAdmin && <NewMedicationModal open={newOpen} onClose={() => setNewOpen(false)} catId={catId} />}
      <LogAdHocMedModal open={adHocOpen} onClose={() => setAdHocOpen(false)} catId={catId} />
    </Card>
  );
}
