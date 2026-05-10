'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Pencil, Plus, Syringe, Trash2 } from 'lucide-react';

import type { UserRole, Vaccination } from '@/lib/supabase/aliases';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { DueChip, computeDueStatus } from '@/components/health/due-chip';
import {
  LogVaccinationModal,
  type EditableVaccination
} from '@/components/health/log-vaccination-modal';

type VaccinationRow = Vaccination & { recorder?: { id: string; full_name: string } | null };

async function fetchVaccinations(catId: string): Promise<VaccinationRow[]> {
  const r = await fetch(`/api/cats/${catId}/vaccinations`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).vaccinations;
}

interface Props {
  catId: string;
  role?: UserRole;
  currentUserId?: string;
}

export function VaccinationsCard({ catId, role, currentUserId }: Props) {
  const t = useTranslations('vaccines');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const isAdmin = role === 'admin';

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EditableVaccination | null>(null);

  const { data: all = [], isLoading } = useQuery({
    queryKey: ['vaccinations', catId],
    queryFn: () => fetchVaccinations(catId)
  });

  const deleteVaccination = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/vaccinations/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('deleted'));
      qc.invalidateQueries({ queryKey: ['vaccinations', catId] });
      qc.invalidateQueries({ queryKey: ['me-cats'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  // Earliest next_due_date across all entries with a due date → drives the chip.
  const nextDue = useMemo(() => {
    const withDue = all.filter((v) => v.next_due_date).map((v) => v.next_due_date!).sort();
    return withDue[0] ?? null;
  }, [all]);

  const chipLabels = {
    overdue: t('chip.overdue'),
    dueSoon: t('chip.dueSoon'),
    ok: t('chip.ok'),
    none: t('chip.none'),
    inDays: (n: number) => t('chip.inDays', { n }),
    agoDays: (n: number) => t('chip.agoDays', { n })
  };

  function canEdit(v: VaccinationRow) {
    return isAdmin || (!!currentUserId && v.recorded_by === currentUserId);
  }

  function startEdit(v: VaccinationRow) {
    setEditing({
      id: v.id,
      vaccine_type: v.vaccine_type,
      vaccine_name: v.vaccine_name,
      administered_date: v.administered_date,
      batch_number: v.batch_number,
      administered_by_vet: v.administered_by_vet,
      next_due_date: v.next_due_date,
      notes: v.notes
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Syringe className="h-4 w-4 text-muted-foreground" />
          {t('title')}
        </CardTitle>
        <div className="flex items-center gap-2">
          <DueChip nextDueISO={nextDue} labels={chipLabels} />
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> {t('log')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{tc('loading')}</p>
        ) : all.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {all.slice(0, 10).map((v) => {
              const due = computeDueStatus(v.next_due_date);
              const editable = canEdit(v);
              return (
                <li
                  key={v.id}
                  className="group flex items-center justify-between gap-3 border-b pb-2 last:border-0"
                >
                  <div className="min-w-0">
                    <div className="font-medium flex items-center gap-2 flex-wrap">
                      {t(`types.${v.vaccine_type}`)}
                      {v.vaccine_name && <span className="text-muted-foreground text-xs">· {v.vaccine_name}</span>}
                      {due.status === 'overdue' && <Badge variant="destructive">{t('chip.overdue')}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(v.administered_date)} · {v.administered_by_vet ?? '—'}
                      {v.batch_number ? ` · #${v.batch_number}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {v.next_due_date && (
                      <span className="text-xs whitespace-nowrap text-muted-foreground">
                        {t('nextDue')}: {formatDate(v.next_due_date)}
                      </span>
                    )}
                    {editable && (
                      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        <button
                          type="button"
                          onClick={() => startEdit(v)}
                          className="p-0.5 text-muted-foreground hover:text-foreground"
                          aria-label={tc('edit')}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(t('confirmDelete'))) deleteVaccination.mutate(v.id);
                          }}
                          className="p-0.5 text-muted-foreground hover:text-destructive"
                          aria-label={tc('delete')}
                          disabled={deleteVaccination.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <LogVaccinationModal open={open} onClose={() => setOpen(false)} catId={catId} />
      <LogVaccinationModal
        key={editing?.id ?? 'edit-idle'}
        open={!!editing}
        onClose={() => setEditing(null)}
        catId={catId}
        editVaccination={editing}
      />
    </Card>
  );
}
