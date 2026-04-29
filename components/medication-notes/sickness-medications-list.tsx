'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Edit, Pill, Plus, Trash2 } from 'lucide-react';

import type { MedicationTemplate, SicknessMedication } from '@/lib/supabase/aliases';
import {
  sicknessMedicationSchema,
  type SicknessMedicationInput
} from '@/lib/schemas/medication-formulary';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { ResponsiveModal } from '@/components/ui/responsive-modal';

type LinkRow = SicknessMedication & { template: MedicationTemplate | null };

async function fetchLinks(sicknessId: string): Promise<LinkRow[]> {
  const r = await fetch(`/api/sicknesses/${sicknessId}/medications`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).links;
}

async function fetchTemplates(): Promise<MedicationTemplate[]> {
  const r = await fetch('/api/medication-templates', { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).templates;
}

export function SicknessMedicationsList({ sicknessId }: { sicknessId: string }) {
  const t = useTranslations('medicationNotes');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<LinkRow | null>(null);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['sickness-medications', sicknessId],
    queryFn: () => fetchLinks(sicknessId)
  });

  const del = useMutation({
    mutationFn: async (linkId: string) => {
      const r = await fetch(`/api/sicknesses/${sicknessId}/medications/${linkId}`, {
        method: 'DELETE'
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('links.removed'));
      qc.invalidateQueries({ queryKey: ['sickness-medications', sicknessId] });
      qc.invalidateQueries({ queryKey: ['sicknesses'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {t('links.title')}
        </span>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> {t('links.add')}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{tc('loading')}</p>
      ) : links.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('links.empty')}</p>
      ) : (
        <ul className="space-y-1.5">
          {links.map((link) => (
            <li key={link.id} className="flex items-start justify-between gap-2 rounded-md border bg-background p-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <Pill className="h-3.5 w-3.5 text-violet-500" />
                  <span className="truncate">
                    {link.template?.name ?? t('links.unknownTemplate')}
                  </span>
                  {link.template?.brand && (
                    <span className="text-xs text-muted-foreground">· {link.template.brand}</span>
                  )}
                  {link.priority > 1 && (
                    <Badge variant="secondary">{t('links.alt', { n: link.priority })}</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {describeRule(link, t as (k: string, p?: Record<string, unknown>) => string)}
                  {link.frequency && <> · {link.frequency}</>}
                  {link.duration_days != null && <> · {t('links.durationDays', { n: link.duration_days })}</>}
                </div>
                {link.notes && (
                  <div className="text-xs text-muted-foreground italic">{link.notes}</div>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setEditing(link)}
                  aria-label={tc('edit')}
                  title={tc('edit')}
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => {
                    if (confirm(t('links.removeConfirm'))) del.mutate(link.id);
                  }}
                  aria-label={tc('delete')}
                  title={tc('delete')}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <LinkSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        sicknessId={sicknessId}
      />
      <LinkSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        sicknessId={sicknessId}
        link={editing ?? undefined}
      />
    </div>
  );
}

function describeRule(
  link: LinkRow,
  t: (k: string, p?: Record<string, unknown>) => string
): string {
  const unit = link.template?.dose_unit ?? 'mg';
  if (link.flat_dose != null) return t('links.flatRule', { dose: link.flat_dose, unit });
  if (link.dose_per_kg != null) {
    const clamps =
      link.min_dose != null || link.max_dose != null
        ? ` · ${t('links.clampRange', {
            min: link.min_dose ?? '—',
            max: link.max_dose ?? '—',
            unit
          })}`
        : '';
    return t('links.perKgRule', { dose: link.dose_per_kg, unit }) + clamps;
  }
  return t('links.noRule');
}

function LinkSheet({
  open,
  onClose,
  sicknessId,
  link
}: {
  open: boolean;
  onClose: () => void;
  sicknessId: string;
  link?: LinkRow;
}) {
  const t = useTranslations('medicationNotes');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const isEdit = !!link;

  const { data: templates = [] } = useQuery({
    queryKey: ['medication-templates', false],
    queryFn: fetchTemplates,
    enabled: open
  });

  const form = useForm<SicknessMedicationInput>({
    resolver: zodResolver(sicknessMedicationSchema),
    values: link
      ? {
          medication_template_id: link.medication_template_id,
          dose_per_kg: link.dose_per_kg,
          flat_dose: link.flat_dose,
          min_dose: link.min_dose,
          max_dose: link.max_dose,
          frequency: link.frequency ?? '',
          duration_days: link.duration_days,
          priority: link.priority,
          notes: link.notes ?? ''
        }
      : undefined,
    defaultValues: link
      ? undefined
      : {
          medication_template_id: '',
          dose_per_kg: null,
          flat_dose: null,
          min_dose: null,
          max_dose: null,
          frequency: 'BID',
          duration_days: 7,
          priority: 1,
          notes: ''
        }
  });

  const m = useMutation({
    mutationFn: async (v: SicknessMedicationInput) => {
      const url = isEdit
        ? `/api/sicknesses/${sicknessId}/medications/${link!.id}`
        : `/api/sicknesses/${sicknessId}/medications`;
      const r = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(v)
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(isEdit ? t('links.updated') : t('links.added'));
      qc.invalidateQueries({ queryKey: ['sickness-medications', sicknessId] });
      qc.invalidateQueries({ queryKey: ['sicknesses'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const errors = form.formState.errors;
  const selectedTemplateId = form.watch('medication_template_id');
  const selectedTemplate = templates.find((tpl) => tpl.id === selectedTemplateId);

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={isEdit ? t('links.editTitle') : t('links.addTitle')}
    >
      <form onSubmit={form.handleSubmit((v) => m.mutate(v))} className="space-y-3 py-2">
        <div className="space-y-1.5">
          <Label>{t('links.fields.template')}</Label>
          <Select
            value={selectedTemplateId || ''}
            onValueChange={(v) => form.setValue('medication_template_id', v, { shouldValidate: true })}
            disabled={isEdit}
          >
            <SelectTrigger><SelectValue placeholder={t('links.fields.templatePlaceholder')} /></SelectTrigger>
            <SelectContent>
              {templates.map((tpl) => (
                <SelectItem key={tpl.id} value={tpl.id}>
                  {tpl.name}{tpl.brand ? ` (${tpl.brand})` : ''} —{' '}
                  {tpl.concentration_amount != null
                    ? `${tpl.concentration_amount} ${tpl.dose_unit}/${tpl.per_unit}`
                    : t(`forms.${tpl.form}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.medication_template_id?.message && (
            <p className="text-xs text-destructive">{errors.medication_template_id.message}</p>
          )}
          {selectedTemplate && (
            <p className="text-xs text-muted-foreground">
              {t('links.templateInfo', {
                form: t(`forms.${selectedTemplate.form}`),
                doseUnit: selectedTemplate.dose_unit
              })}
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={t('links.fields.dosePerKg')}
            error={errors.dose_per_kg?.message as string | undefined}
            hint={t('links.fields.dosePerKgHint', { unit: selectedTemplate?.dose_unit ?? 'mg' })}
          >
            <Input
              type="number"
              step="0.0001"
              min="0"
              {...form.register('dose_per_kg')}
            />
          </Field>
          <Field
            label={t('links.fields.flatDose')}
            error={errors.flat_dose?.message as string | undefined}
            hint={t('links.fields.flatDoseHint', { unit: selectedTemplate?.dose_unit ?? 'mg' })}
          >
            <Input
              type="number"
              step="0.0001"
              min="0"
              {...form.register('flat_dose')}
            />
          </Field>
          <Field
            label={t('links.fields.minDose')}
            error={errors.min_dose?.message as string | undefined}
          >
            <Input
              type="number"
              step="0.0001"
              min="0"
              {...form.register('min_dose')}
            />
          </Field>
          <Field
            label={t('links.fields.maxDose')}
            error={errors.max_dose?.message as string | undefined}
          >
            <Input
              type="number"
              step="0.0001"
              min="0"
              {...form.register('max_dose')}
            />
          </Field>
          <Field label={t('links.fields.frequency')}>
            <Input placeholder="BID, every 12h, …" {...form.register('frequency')} />
          </Field>
          <Field label={t('links.fields.durationDays')}>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              {...form.register('duration_days')}
            />
          </Field>
          <Field
            label={t('links.fields.priority')}
            hint={t('links.fields.priorityHint')}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={10}
              {...form.register('priority')}
            />
          </Field>
        </div>

        <Field label={t('links.fields.notes')}>
          <Textarea rows={2} {...form.register('notes')} />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button type="submit" disabled={m.isPending}>
            {m.isPending ? tc('saving') : isEdit ? tc('save') : tc('add')}
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}

function Field({
  label,
  error,
  hint,
  children
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
