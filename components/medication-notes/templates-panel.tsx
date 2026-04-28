'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Edit, Pill, Plus, Trash2 } from 'lucide-react';

import type { MedicationTemplate, MedicationForm, MedRoute } from '@/lib/supabase/aliases';
import {
  medicationTemplateSchema,
  type MedicationTemplateInput
} from '@/lib/schemas/medication-formulary';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

const FORMS: MedicationForm[] = [
  'tablet',
  'capsule',
  'liquid',
  'injection',
  'drops',
  'powder',
  'topical',
  'other'
];
const ROUTES: MedRoute[] = ['oral', 'topical', 'injection', 'other'];
const SPLITS: number[] = [1, 2, 4];

// Sensible defaults so admins don't have to set every field. The dose unit is
// almost always mg, and per-unit follows the form (tablet → "tablet", liquid
// → "ml", …).
const PER_UNIT_DEFAULTS: Record<MedicationForm, string> = {
  tablet: 'tablet',
  capsule: 'capsule',
  liquid: 'ml',
  injection: 'ml',
  drops: 'drop',
  powder: 'sachet',
  topical: 'application',
  other: 'unit'
};

async function fetchTemplates(includeInactive: boolean): Promise<MedicationTemplate[]> {
  const qs = includeInactive ? '?include_inactive=1' : '';
  const r = await fetch(`/api/medication-templates${qs}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).templates;
}

export function TemplatesPanel() {
  const t = useTranslations('medicationNotes');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<MedicationTemplate | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['medication-templates', showInactive],
    queryFn: () => fetchTemplates(showInactive)
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/medication-templates/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('templates.deactivated'));
      qc.invalidateQueries({ queryKey: ['medication-templates'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('templates.description')}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowInactive((v) => !v)}>
            {showInactive ? t('hideInactive') : t('showInactive')}
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t('templates.new')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">{tc('loading')}</CardContent></Card>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{t('templates.empty')}</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {items.map((tpl) => (
            <Card key={tpl.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                    <Pill className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="truncate">{tpl.name}</span>
                      {tpl.brand && (
                        <span className="text-xs text-muted-foreground">· {tpl.brand}</span>
                      )}
                      <Badge variant="secondary">{t(`forms.${tpl.form}`)}</Badge>
                      {!tpl.is_active && <Badge variant="destructive">{t('inactive')}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tpl.concentration_amount != null
                        ? `${tpl.concentration_amount} ${tpl.dose_unit} / ${tpl.per_unit}`
                        : t('templates.noConcentration')}
                      {' · '}
                      {t(`routes.${tpl.default_route}`)}
                      {tpl.splittable_into > 1 && (
                        <> · {t('templates.splittableLabel', { n: tpl.splittable_into })}</>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(tpl)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  {tpl.is_active && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm(t('templates.deactivateConfirm'))) del.mutate(tpl.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TemplateSheet open={createOpen} onClose={() => setCreateOpen(false)} />
      <TemplateSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        template={editing ?? undefined}
      />
    </div>
  );
}

function TemplateSheet({
  open,
  onClose,
  template
}: {
  open: boolean;
  onClose: () => void;
  template?: MedicationTemplate;
}) {
  const t = useTranslations('medicationNotes');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const isEdit = !!template;

  const form = useForm<MedicationTemplateInput>({
    resolver: zodResolver(medicationTemplateSchema),
    values: template
      ? {
          name: template.name,
          brand: template.brand ?? '',
          form: template.form,
          concentration_amount: template.concentration_amount,
          dose_unit: template.dose_unit,
          per_unit: template.per_unit,
          default_route: template.default_route,
          splittable_into: template.splittable_into,
          notes: template.notes ?? '',
          is_active: template.is_active
        }
      : undefined,
    defaultValues: template
      ? undefined
      : {
          name: '',
          brand: '',
          form: 'tablet',
          concentration_amount: null,
          dose_unit: 'mg',
          per_unit: 'tablet',
          default_route: 'oral',
          splittable_into: 1,
          notes: '',
          is_active: true
        }
  });

  const m = useMutation({
    mutationFn: async (v: MedicationTemplateInput) => {
      const r = await fetch(
        isEdit ? `/api/medication-templates/${template!.id}` : '/api/medication-templates',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(v)
        }
      );
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(isEdit ? t('templates.updated') : t('templates.created'));
      qc.invalidateQueries({ queryKey: ['medication-templates'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const errors = form.formState.errors;
  const formVal = form.watch('form') ?? 'tablet';

  // When the user changes form, suggest the matching per_unit. We only do this
  // when creating — editing should preserve whatever the admin set.
  function handleFormChange(next: MedicationForm) {
    form.setValue('form', next, { shouldValidate: true });
    if (!isEdit) {
      form.setValue('per_unit', PER_UNIT_DEFAULTS[next], { shouldValidate: true });
      // Tablets/capsules typically split; liquids/topicals don't.
      if (next === 'tablet') form.setValue('splittable_into', 4);
      else if (next === 'capsule') form.setValue('splittable_into', 1);
      else form.setValue('splittable_into', 1);
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={isEdit ? t('templates.editTitle') : t('templates.newTitle')}
    >
      <form onSubmit={form.handleSubmit((v) => m.mutate(v))} className="space-y-3 py-2">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('templates.fields.name')} error={errors.name?.message}>
            <Input {...form.register('name')} />
          </Field>
          <Field label={t('templates.fields.brand')}>
            <Input {...form.register('brand')} />
          </Field>
          <Field label={t('templates.fields.form')}>
            <Select value={formVal} onValueChange={(v) => handleFormChange(v as MedicationForm)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORMS.map((f) => (
                  <SelectItem key={f} value={f}>{t(`forms.${f}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('templates.fields.defaultRoute')}>
            <Select
              value={form.watch('default_route') ?? 'oral'}
              onValueChange={(v) => form.setValue('default_route', v as MedRoute)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROUTES.map((r) => (
                  <SelectItem key={r} value={r}>{t(`routes.${r}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label={t('templates.fields.concentrationAmount')}
            error={errors.concentration_amount?.message as string | undefined}
            hint={t('templates.fields.concentrationHint')}
          >
            <Input
              type="number"
              step="0.0001"
              min="0"
              placeholder="e.g. 50"
              {...form.register('concentration_amount')}
            />
          </Field>
          <Field label={t('templates.fields.doseUnit')}>
            <Input placeholder="mg" {...form.register('dose_unit')} />
          </Field>
          <Field label={t('templates.fields.perUnit')} hint={t('templates.fields.perUnitHint')}>
            <Input placeholder="tablet" {...form.register('per_unit')} />
          </Field>
          <Field
            label={t('templates.fields.splittable')}
            hint={t('templates.fields.splittableHint')}
          >
            <Select
              value={String(form.watch('splittable_into') ?? 1)}
              onValueChange={(v) => form.setValue('splittable_into', Number(v))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SPLITS.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {t(`templates.splittableValues.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label={t('templates.fields.notes')}>
          <Textarea rows={2} {...form.register('notes')} />
        </Field>

        {isEdit && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register('is_active')} />
            {t('templates.fields.active')}
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
