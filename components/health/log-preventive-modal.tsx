'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  preventiveTreatmentSchema,
  PREVENTIVE_DEFAULT_INTERVAL_DAYS,
  type PreventiveTreatmentInput,
  type PreventiveTypeInput
} from '@/lib/schemas/preventive';
import type { PreventiveType } from '@/lib/supabase/aliases';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveModal } from '@/components/ui/responsive-modal';

const TYPES: PreventiveType[] = ['deworming', 'flea', 'combined'];

function addDays(yyyyMmDd: string, days: number): string {
  const d = new Date(yyyyMmDd);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export type EditablePreventiveTreatment = {
  id: string;
  treatment_type: PreventiveTypeInput;
  product_name: string;
  administered_date: string;
  next_due_date: string | null;
  notes: string | null;
};

export function LogPreventiveModal({
  open,
  onClose,
  catId,
  editTreatment
}: {
  open: boolean;
  onClose: () => void;
  catId: string;
  editTreatment?: EditablePreventiveTreatment | null;
}) {
  const t = useTranslations('preventive');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const isEditing = !!editTreatment;

  const today = new Date().toISOString().slice(0, 10);
  const form = useForm<PreventiveTreatmentInput>({
    resolver: zodResolver(preventiveTreatmentSchema),
    defaultValues: editTreatment
      ? {
          treatment_type: editTreatment.treatment_type,
          product_name: editTreatment.product_name,
          administered_date: editTreatment.administered_date,
          next_due_date: editTreatment.next_due_date ?? '',
          notes: editTreatment.notes ?? ''
        }
      : {
          treatment_type: 'deworming',
          product_name: '',
          administered_date: today,
          next_due_date: addDays(today, PREVENTIVE_DEFAULT_INTERVAL_DAYS),
          notes: ''
        }
  });

  const watchedAdmin = form.watch('administered_date');
  useEffect(() => {
    // Only auto-advance next_due_date when creating — editing shouldn't clobber
    // a user's existing due date every time they touch administered_date.
    if (!isEditing && watchedAdmin) {
      form.setValue('next_due_date', addDays(watchedAdmin, PREVENTIVE_DEFAULT_INTERVAL_DAYS), { shouldValidate: false });
    }
  }, [watchedAdmin, form, isEditing]);

  const m = useMutation({
    mutationFn: async (v: PreventiveTreatmentInput) => {
      const url = isEditing
        ? `/api/preventive/${editTreatment!.id}`
        : `/api/cats/${catId}/preventive`;
      const r = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(v)
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(isEditing ? t('updated') : t('logged'));
      qc.invalidateQueries({ queryKey: ['preventive', catId] });
      qc.invalidateQueries({ queryKey: ['me-cats'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const errors = form.formState.errors;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={isEditing ? t('edit') : t('log')}
    >
      <form onSubmit={form.handleSubmit((v) => m.mutate(v))} className="space-y-3 py-2">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('fields.type')}>
            <Select
              value={form.watch('treatment_type') ?? 'deworming'}
              onValueChange={(v) => form.setValue('treatment_type', v as PreventiveTypeInput)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((ty) => (
                  <SelectItem key={ty} value={ty}>{t(`types.${ty}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('fields.administeredDate')} error={errors.administered_date?.message}>
            <Input type="date" {...form.register('administered_date')} />
          </Field>
        </div>

        <Field label={t('fields.productName')} error={errors.product_name?.message}>
          <Input {...form.register('product_name')} />
        </Field>

        <Field label={t('fields.nextDueDate')}>
          <Input type="date" {...form.register('next_due_date')} />
        </Field>

        <Field label={t('fields.notes')}>
          <Textarea rows={2} {...form.register('notes')} />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button type="submit" disabled={m.isPending}>
            {m.isPending ? tc('saving') : tc('save')}
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
