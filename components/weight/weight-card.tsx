'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Scale, Pencil, Trash2 } from 'lucide-react';

import type { UserRole, WeightLog } from '@/lib/supabase/aliases';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LogWeightModal } from '@/components/weight/log-weight-modal';
import { LineChart } from '@/components/reports/charts';
import { formatDate } from '@/lib/utils';

type WeightLogRow = WeightLog & { submitter?: { id: string; full_name: string } | null };

async function fetchWeightLogs(catId: string): Promise<WeightLogRow[]> {
  const r = await fetch(`/api/cats/${catId}/weight?limit=50`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).logs;
}

interface Props {
  catId: string;
  role: UserRole;
  currentUserId: string;
}

export function WeightCard({ catId, role, currentUserId }: Props) {
  const t = useTranslations('weight');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const isAdmin = role === 'admin';

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['weight', catId],
    queryFn: () => fetchWeightLogs(catId)
  });

  const latest = logs[0];
  const ascending = [...logs].reverse();
  const prev = logs[1];
  const delta = latest && prev ? latest.weight_kg - prev.weight_kg : null;
  const deltaPct = latest && prev && prev.weight_kg > 0
    ? ((latest.weight_kg - prev.weight_kg) / prev.weight_kg) * 100
    : null;

  const updateLog = useMutation({
    mutationFn: async ({ id, weight_kg }: { id: string; weight_kg: number }) => {
      const r = await fetch(`/api/weight-logs/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ weight_kg })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('updated'));
      qc.invalidateQueries({ queryKey: ['weight', catId] });
      qc.invalidateQueries({ queryKey: ['calorie-summary', catId] });
      setEditingId(null);
      setEditValue('');
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const deleteLog = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/weight-logs/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('deleted'));
      qc.invalidateQueries({ queryKey: ['weight', catId] });
      qc.invalidateQueries({ queryKey: ['calorie-summary', catId] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  function canEdit(log: WeightLogRow): boolean {
    return isAdmin || log.submitted_by === currentUserId;
  }

  function startEdit(log: WeightLogRow) {
    setEditingId(log.id);
    setEditValue(String(log.weight_kg));
  }

  function saveEdit() {
    if (!editingId) return;
    const parsed = Number(editValue);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error(t('errors.invalidWeight'));
      return;
    }
    updateLog.mutate({ id: editingId, weight_kg: parsed });
  }

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
              <div className="rounded-md border bg-muted/20 p-2">
                <LineChart
                  data={[{
                    name: 'kg',
                    points: ascending.map((p) => ({ x: p.recorded_at, y: Number(p.weight_kg) }))
                  }]}
                  height={180}
                  yLabel="kg"
                />
              </div>
            )}
            <ul className="max-h-40 overflow-y-auto space-y-1 text-sm">
              {logs.slice(0, 10).map((l) => {
                const editable = canEdit(l);
                const isEditing = editingId === l.id;
                return (
                  <li key={l.id} className="flex items-center justify-between border-b py-1 last:border-0 group gap-2">
                    {isEditing ? (
                      <>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.1"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-7 w-24 text-sm"
                          autoFocus
                        />
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="sm" variant="default" className="h-7 text-xs px-2" onClick={saveEdit} disabled={updateLog.isPending}>
                            {tc('save')}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditingId(null)}>
                            {tc('cancel')}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="font-medium shrink-0">{l.weight_kg} kg</span>
                        <span className="text-xs text-muted-foreground truncate flex-1 text-right">
                          {formatDate(l.recorded_at)} · {l.submitter?.full_name ?? '—'}
                        </span>
                        {editable && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              type="button"
                              onClick={() => startEdit(l)}
                              className="text-muted-foreground hover:text-foreground p-0.5"
                              aria-label={tc('edit')}
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(t('confirmDelete'))) deleteLog.mutate(l.id);
                              }}
                              className="text-muted-foreground hover:text-destructive p-0.5"
                              aria-label={tc('delete')}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>

      <LogWeightModal open={open} onClose={() => setOpen(false)} catId={catId} />
    </Card>
  );
}
