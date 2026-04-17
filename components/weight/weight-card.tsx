'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowRight, Plus, Scale, Pencil, Trash2 } from 'lucide-react';

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
  const locale = useLocale();
  const qc = useQueryClient();
  const isAdmin = role === 'admin';
  // Locale-aware grouping (thousand separator follows the user's language —
  // comma in en-US, dot in id-ID, etc.). The grams reading is always an
  // integer so we never want fractional digits here.
  const gramsFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const formatGrams = (g: number) => gramsFormatter.format(g);
  const formatDeltaGrams = (g: number) =>
    `${g > 0 ? '+' : g < 0 ? '−' : ''}${gramsFormatter.format(Math.abs(g))}`;

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
  // Sitters read scales in grams, so the card renders every weight value in
  // grams even though the database column is still kg. Convert once here.
  const toGrams = (kg: number) => Math.round(kg * 1000);
  const deltaG = latest && prev ? toGrams(latest.weight_kg) - toGrams(prev.weight_kg) : null;
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
    setEditValue(String(toGrams(log.weight_kg)));
  }

  function saveEdit() {
    if (!editingId) return;
    const parsedG = Number(editValue);
    if (isNaN(parsedG) || parsedG <= 0) {
      toast.error(t('errors.invalidWeight'));
      return;
    }
    updateLog.mutate({ id: editingId, weight_kg: parsedG / 1000 });
  }

  return (
    <Card className="overflow-hidden border-l-4 border-l-sky-400 bg-gradient-to-r from-sky-50/50 to-transparent dark:from-sky-950/20">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="h-4 w-4 text-sky-500" />
          {t('title')}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Link
            href={`/cats/${catId}/weight`}
            className="text-xs text-sky-700 hover:text-sky-800 dark:text-sky-300 dark:hover:text-sky-200 inline-flex items-center gap-0.5"
          >
            {tc('viewDetails')} <ArrowRight className="h-3 w-3" />
          </Link>
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            className="bg-sky-500 text-white shadow hover:bg-sky-600"
          >
            <Plus className="h-4 w-4" /> {t('log')}
          </Button>
        </div>
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
                {formatGrams(toGrams(Number(latest!.weight_kg)))} <span className="text-base font-normal text-muted-foreground">g</span>
              </div>
              {deltaG !== null && (
                <span
                  className={
                    'text-xs ' +
                    (Math.abs(deltaPct ?? 0) >= 10
                      ? 'text-destructive'
                      : deltaG > 0
                        ? 'text-emerald-600'
                        : deltaG < 0
                          ? 'text-amber-600'
                          : 'text-muted-foreground')
                  }
                >
                  {formatDeltaGrams(deltaG)} g
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
                    name: 'g',
                    points: ascending.map((p) => ({ x: p.recorded_at, y: toGrams(Number(p.weight_kg)) }))
                  }]}
                  height={180}
                  yLabel="g"
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
                          inputMode="numeric"
                          step="1"
                          min="1"
                          max="29999"
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
                        <span className="font-medium shrink-0">{formatGrams(toGrams(Number(l.weight_kg)))} g</span>
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
