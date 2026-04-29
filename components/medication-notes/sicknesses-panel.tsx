'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { BookOpen, ChevronDown, ChevronRight, Edit, Plus, Trash2 } from 'lucide-react';

import type { Sickness } from '@/lib/supabase/aliases';
import {
  sicknessSchema,
  type SicknessInput
} from '@/lib/schemas/medication-formulary';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveModal } from '@/components/ui/responsive-modal';

import { SicknessMedicationsList } from './sickness-medications-list';

type SicknessWithCount = Sickness & {
  medication_count?: { count: number }[];
};

async function fetchSicknesses(includeInactive: boolean): Promise<SicknessWithCount[]> {
  const qs = `?with_counts=1${includeInactive ? '&include_inactive=1' : ''}`;
  const r = await fetch(`/api/sicknesses${qs}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).sicknesses;
}

export function SicknessesPanel() {
  const t = useTranslations('medicationNotes');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Sickness | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['sicknesses', showInactive],
    queryFn: () => fetchSicknesses(showInactive)
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/sicknesses/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('sicknesses.deactivated'));
      qc.invalidateQueries({ queryKey: ['sicknesses'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('sicknesses.description')}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowInactive((v) => !v)}>
            {showInactive ? t('hideInactive') : t('showInactive')}
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t('sicknesses.new')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">{tc('loading')}</CardContent></Card>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{t('sicknesses.empty')}</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {items.map((s) => {
            const open = expanded.has(s.id);
            const medCount = s.medication_count?.[0]?.count ?? 0;
            return (
              <Card key={s.id} className={open ? 'ring-1 ring-violet-200 dark:ring-violet-900' : ''}>
                <CardContent className="p-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => toggle(s.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 font-medium">
                          {open ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="truncate">{s.name}</span>
                          <Badge variant="secondary">{t('sicknesses.medCount', { n: medCount })}</Badge>
                          {!s.is_active && <Badge variant="destructive">{t('inactive')}</Badge>}
                        </div>
                        {s.description && (
                          <div className="ml-6 truncate text-xs text-muted-foreground">
                            {s.description}
                          </div>
                        )}
                      </div>
                    </button>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(s)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      {s.is_active && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm(t('sicknesses.deactivateConfirm'))) del.mutate(s.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {open && (
                    <div className="border-t pt-3">
                      <SicknessMedicationsList sicknessId={s.id} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <SicknessSheet open={createOpen} onClose={() => setCreateOpen(false)} />
      <SicknessSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        sickness={editing ?? undefined}
      />
    </div>
  );
}

function SicknessSheet({
  open,
  onClose,
  sickness
}: {
  open: boolean;
  onClose: () => void;
  sickness?: Sickness;
}) {
  const t = useTranslations('medicationNotes');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const isEdit = !!sickness;

  const form = useForm<SicknessInput>({
    resolver: zodResolver(sicknessSchema),
    values: sickness
      ? {
          name: sickness.name,
          description: sickness.description ?? '',
          is_active: sickness.is_active
        }
      : undefined,
    defaultValues: sickness
      ? undefined
      : { name: '', description: '', is_active: true }
  });

  const m = useMutation({
    mutationFn: async (v: SicknessInput) => {
      const r = await fetch(
        isEdit ? `/api/sicknesses/${sickness!.id}` : '/api/sicknesses',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(v)
        }
      );
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(isEdit ? t('sicknesses.updated') : t('sicknesses.created'));
      qc.invalidateQueries({ queryKey: ['sicknesses'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const errors = form.formState.errors;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={isEdit ? t('sicknesses.editTitle') : t('sicknesses.newTitle')}
    >
      <form onSubmit={form.handleSubmit((v) => m.mutate(v))} className="space-y-3 py-2">
        <div className="space-y-1.5">
          <Label>{t('sicknesses.fields.name')}</Label>
          <Input {...form.register('name')} />
          {errors.name?.message && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>{t('sicknesses.fields.description')}</Label>
          <Textarea rows={3} {...form.register('description')} />
        </div>
        {isEdit && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register('is_active')} />
            {t('sicknesses.fields.active')}
          </label>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button type="submit" disabled={m.isPending}>
            {m.isPending ? tc('saving') : isEdit ? tc('save') : tc('create')}
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
