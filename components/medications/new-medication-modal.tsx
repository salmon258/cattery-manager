'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';

import { medicationSchema, type MedicationInput, type MedRouteInput } from '@/lib/schemas/medications';
import type { MedRoute } from '@/lib/supabase/aliases';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveModal } from '@/components/ui/responsive-modal';

const ROUTES: MedRoute[] = ['oral', 'topical', 'injection', 'other'];

export function NewMedicationModal({
  open,
  onClose,
  catId
}: {
  open: boolean;
  onClose: () => void;
  catId: string;
}) {
  const t = useTranslations('medications');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);
  const endDefault = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 6); // 7-day default
    return d.toISOString().slice(0, 10);
  })();

  const form = useForm<MedicationInput>({
    resolver: zodResolver(medicationSchema),
    defaultValues: {
      medicine_name: '',
      dose: '',
      route: 'oral',
      start_date: today,
      end_date: endDefault,
      interval_days: 1,
      time_slots: ['08:00', '20:00'],
      notes: ''
    }
  });

  const slots = form.watch('time_slots') ?? [];
  const endDate = form.watch('end_date');
  const indefinite = endDate == null || endDate === '';

  const m = useMutation({
    mutationFn: async (v: MedicationInput) => {
      const r = await fetch(`/api/cats/${catId}/medications`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(v)
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('created'));
      qc.invalidateQueries({ queryKey: ['medications', catId] });
      qc.invalidateQueries({ queryKey: ['me-tasks'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const errors = form.formState.errors;

  function updateSlot(idx: number, value: string) {
    const next = [...slots];
    next[idx] = value;
    form.setValue('time_slots', next, { shouldValidate: true });
  }
  function addSlot() {
    form.setValue('time_slots', [...slots, '12:00'], { shouldValidate: true });
  }
  function removeSlot(idx: number) {
    const next = slots.filter((_, i) => i !== idx);
    form.setValue('time_slots', next, { shouldValidate: true });
  }

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !o && onClose()} title={t('newSchedule')}>
      <form onSubmit={form.handleSubmit((v) => m.mutate(v))} className="space-y-3 py-2">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('fields.name')} error={errors.medicine_name?.message}>
            <Input {...form.register('medicine_name')} />
          </Field>
          <Field label={t('fields.dose')} error={errors.dose?.message}>
            <Input placeholder="e.g. 5 mg" {...form.register('dose')} />
          </Field>
          <Field label={t('fields.route')}>
            <Select
              value={form.watch('route') ?? 'oral'}
              onValueChange={(v) => form.setValue('route', v as MedRouteInput)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROUTES.map((r) => (
                  <SelectItem key={r} value={r}>{t(`routes.${r}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('fields.intervalDays')} error={errors.interval_days?.message}>
            <Input type="number" inputMode="numeric" min={1} max={365} {...form.register('interval_days')} />
          </Field>
          <Field label={t('fields.startDate')} error={errors.start_date?.message}>
            <Input type="date" {...form.register('start_date')} />
          </Field>
          <Field label={t('fields.endDate')} error={errors.end_date?.message}>
            <Input
              type="date"
              value={endDate ?? ''}
              onChange={(e) =>
                form.setValue('end_date', e.target.value || null, { shouldValidate: true })
              }
              disabled={indefinite}
            />
            <label className="flex items-center gap-1.5 text-xs cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={indefinite}
                onChange={(e) =>
                  form.setValue('end_date', e.target.checked ? null : endDefault, { shouldValidate: true })
                }
                className="h-3.5 w-3.5"
              />
              <span>{t('indefinite')}</span>
              <span className="text-muted-foreground">— {t('indefiniteHint')}</span>
            </label>
          </Field>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t('fields.timeSlots')}</Label>
            <Button type="button" variant="outline" size="sm" onClick={addSlot}>
              <Plus className="h-3 w-3" /> {t('addSlot')}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {slots.map((s, i) => (
              <div key={i} className="flex items-center gap-1 rounded-md border px-2 py-1">
                <Input
                  type="time"
                  value={s}
                  onChange={(e) => updateSlot(i, e.target.value)}
                  className="h-8 w-24 border-0 p-0 focus-visible:ring-0"
                />
                {slots.length > 1 && (
                  <button type="button" onClick={() => removeSlot(i)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {errors.time_slots?.message && (
            <p className="text-xs text-destructive">{errors.time_slots.message as string}</p>
          )}
          <p className="text-xs text-muted-foreground">{t('slotsHint')}</p>
        </div>

        <Field label={t('fields.notes')}>
          <Textarea rows={2} {...form.register('notes')} />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button type="submit" disabled={m.isPending}>
            {m.isPending ? tc('saving') : tc('create')}
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
