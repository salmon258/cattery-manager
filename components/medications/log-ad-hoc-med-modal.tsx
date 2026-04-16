'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { adHocMedicineSchema, type AdHocMedicineInput, type MedRouteInput } from '@/lib/schemas/medications';
import type { MedRoute } from '@/lib/supabase/aliases';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveModal } from '@/components/ui/responsive-modal';

const ROUTES: MedRoute[] = ['oral', 'topical', 'injection', 'other'];

export function LogAdHocMedModal({
  open,
  onClose,
  catId,
  catName
}: {
  open: boolean;
  onClose: () => void;
  catId: string;
  catName?: string;
}) {
  const t = useTranslations('medications.adHoc');
  const tm = useTranslations('medications');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const form = useForm<AdHocMedicineInput>({
    resolver: zodResolver(adHocMedicineSchema),
    defaultValues: {
      medicine_name: '',
      dose: '',
      unit: '',
      route: 'oral',
      notes: ''
    }
  });

  useEffect(() => {
    if (!open) return;
    form.reset({ medicine_name: '', dose: '', unit: '', route: 'oral', notes: '' });
    // Focus after the drawer / dialog open animation so the vaul/Radix
    // focus trap (and iOS keyboard heuristics) don't steal focus back.
    const t = setTimeout(() => form.setFocus('medicine_name'), 120);
    return () => clearTimeout(t);
  }, [open, form]);

  const m = useMutation({
    mutationFn: async (v: AdHocMedicineInput) => {
      const r = await fetch(`/api/cats/${catId}/ad-hoc-meds`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(v)
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('logged'));
      qc.invalidateQueries({ queryKey: ['ad-hoc-meds', catId] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const errors = form.formState.errors;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={catName ? t('titleFor', { name: catName }) : t('title')}
    >
      <form onSubmit={form.handleSubmit((v) => m.mutate(v))} className="space-y-3 py-2">
        <Field label={t('fields.medicineName')} error={errors.medicine_name?.message}>
          <Input {...form.register('medicine_name')} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('fields.dose')}>
            <Input placeholder="e.g. 5 mg" {...form.register('dose')} />
          </Field>
          <Field label={t('fields.unit')}>
            <Input placeholder="mg / ml" {...form.register('unit')} />
          </Field>
          <Field label={tm('fields.route')}>
            <Select
              value={form.watch('route') ?? 'oral'}
              onValueChange={(v) => form.setValue('route', v as MedRouteInput)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROUTES.map((r) => (
                  <SelectItem key={r} value={r}>{tm(`routes.${r}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

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
