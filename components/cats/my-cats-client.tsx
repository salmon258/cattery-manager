'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Check,
  FlaskConical,
  Home,
  ListChecks,
  Scale,
  Timer,
  Utensils
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Cat } from '@/lib/supabase/types';
import { LogWeightModal } from '@/components/weight/log-weight-modal';
import { LogEatingModal } from '@/components/eating/log-eating-modal';
import { LogAdHocMedModal } from '@/components/medications/log-ad-hoc-med-modal';

type MyCat = Cat & {
  current_room?: { id: string; name: string } | null;
  assignee?: { id: string; full_name: string } | null;
  last_weight_recorded_at?: string | null;
};

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

type MyTask = {
  id: string;
  due_at: string;
  cat: { id: string; name: string };
  medication: { id: string; medicine_name: string; dose: string };
};

async function fetchMyCats(): Promise<MyCat[]> {
  const r = await fetch('/api/me/cats', { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).cats;
}

async function fetchMyTasks(): Promise<MyTask[]> {
  const r = await fetch('/api/me/tasks', { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).tasks;
}

export function MyCatsClient({ firstName }: { firstName: string }) {
  const ts = useTranslations('sitterHome');
  const tc = useTranslations('common');
  const tq = useTranslations('sitterActions');
  const tm = useTranslations('medications');
  const qc = useQueryClient();

  const [weightTarget, setWeightTarget] = useState<{ id: string; name: string } | null>(null);
  const [mealTarget, setMealTarget] = useState<{ id: string; name: string } | null>(null);
  const [medTarget, setMedTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: cats = [], isLoading, error, refetch } = useQuery({
    queryKey: ['me-cats'],
    queryFn: fetchMyCats
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ['me-tasks'],
    queryFn: fetchMyTasks
  });

  const tasksByCat = useMemo(() => {
    const map = new Map<string, MyTask[]>();
    for (const t of tasks) {
      if (!map.has(t.cat.id)) map.set(t.cat.id, []);
      map.get(t.cat.id)!.push(t);
    }
    return map;
  }, [tasks]);

  const confirm = useMutation({
    mutationFn: async (taskId: string) => {
      const r = await fetch(`/api/tasks/${taskId}/confirm`, { method: 'POST' });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(tm('taskConfirmed'));
      qc.invalidateQueries({ queryKey: ['me-tasks'] });
      qc.invalidateQueries({ queryKey: ['medication-tasks'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const reportIssueComingSoon = () => {
    toast.message(tq('comingSoon'), { description: tq('reportIssue') });
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">{ts('title', { name: firstName })}</h1>
        <p className="text-sm text-muted-foreground">{ts('subtitle')}</p>
      </header>

      {isLoading && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{tc('loading')}</CardContent></Card>
      )}
      {error && (
        <Card>
          <CardContent className="p-6 text-sm flex items-center justify-between">
            <span className="text-destructive">{tc('error')}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>{tc('retry')}</Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && cats.length === 0 && (
        <Card>
          <CardContent className="p-6 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              {ts('assignedTitle')}
            </div>
            <p className="text-sm text-muted-foreground">{ts('emptyHint')}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {cats.map((c) => {
          const catTasks = tasksByCat.get(c.id) ?? [];
          const needsWeightToday = !c.last_weight_recorded_at || !isToday(c.last_weight_recorded_at);
          const totalTodoCount = catTasks.length + (needsWeightToday ? 1 : 0);
          return (
            <Card key={c.id}>
              <CardContent className="p-4 space-y-3">
                <Link href={`/cats/${c.id}`} className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    {c.profile_photo_url ? <AvatarImage src={c.profile_photo_url} alt={c.name} /> : null}
                    <AvatarFallback>{c.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate flex items-center gap-2">
                      {c.name}
                      {totalTodoCount > 0 && (
                        <Badge variant="destructive" className="gap-1">
                          <Timer className="h-3 w-3" /> {totalTodoCount}
                        </Badge>
                      )}
                    </div>
                    {c.current_room && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Home className="h-3 w-3" /> {c.current_room.name}
                      </div>
                    )}
                  </div>
                </Link>

                {(catTasks.length > 0 || needsWeightToday) && (
                  <ul className="space-y-1">
                    {needsWeightToday && (
                      <li className="flex items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-sm">
                        <div className="min-w-0">
                          <div className="font-medium truncate flex items-center gap-1.5">
                            <Scale className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                            {tq('weightDue')}
                          </div>
                          <div className="text-xs text-muted-foreground">{tq('weightDueHint')}</div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setWeightTarget({ id: c.id, name: c.name })}
                        >
                          <Scale className="h-3.5 w-3.5" /> {tq('logWeight')}
                        </Button>
                      </li>
                    )}
                    {catTasks.map((task) => {
                      const overdue = new Date(task.due_at) < new Date();
                      return (
                        <li
                          key={task.id}
                          className={cn(
                            'flex items-center justify-between gap-2 rounded-md border p-2 text-sm',
                            overdue && 'border-destructive/40 bg-destructive/5'
                          )}
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">
                              {task.medication.medicine_name}{' '}
                              <span className="text-xs text-muted-foreground">· {task.medication.dose}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(task.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {overdue && ` · ${tm('overdue')}`}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            disabled={confirm.isPending}
                            onClick={() => confirm.mutate(task.id)}
                          >
                            <Check className="h-3.5 w-3.5" /> {tm('confirm')}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <QuickAction
                    icon={Scale}
                    label={tq('logWeight')}
                    onClick={() => setWeightTarget({ id: c.id, name: c.name })}
                  />
                  <QuickAction
                    icon={Utensils}
                    label={tq('logMeal')}
                    onClick={() => setMealTarget({ id: c.id, name: c.name })}
                  />
                  <QuickAction
                    icon={FlaskConical}
                    label={tq('logMed')}
                    onClick={() => setMedTarget({ id: c.id, name: c.name })}
                  />
                  <QuickAction
                    icon={AlertTriangle}
                    label={tq('reportIssue')}
                    onClick={reportIssueComingSoon}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <LogWeightModal
        open={!!weightTarget}
        onClose={() => setWeightTarget(null)}
        catId={weightTarget?.id ?? ''}
        catName={weightTarget?.name}
      />
      <LogEatingModal
        open={!!mealTarget}
        onClose={() => setMealTarget(null)}
        catId={mealTarget?.id ?? ''}
        catName={mealTarget?.name}
      />
      <LogAdHocMedModal
        open={!!medTarget}
        onClose={() => setMedTarget(null)}
        catId={medTarget?.id ?? ''}
        catName={medTarget?.name}
      />
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick
}: {
  icon: typeof Scale;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-auto flex-col gap-1 py-2"
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
      <span className="text-[11px]">{label}</span>
    </Button>
  );
}
