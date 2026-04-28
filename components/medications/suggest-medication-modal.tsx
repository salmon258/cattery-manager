'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, Pill, Scale } from 'lucide-react';

import type { MedicationForm, MedRoute, Sickness } from '@/lib/supabase/aliases';
import type { DoseSuggestion } from '@/lib/dose-calculator';
import { formatAmount } from '@/lib/dose-calculator';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { ResponsiveModal } from '@/components/ui/responsive-modal';

type Suggestion = {
  link_id: string;
  priority: number;
  frequency: string | null;
  duration_days: number | null;
  notes: string | null;
  rule: {
    dose_per_kg: number | null;
    flat_dose: number | null;
    min_dose: number | null;
    max_dose: number | null;
  };
  template: {
    id: string;
    name: string;
    brand: string | null;
    form: MedicationForm;
    concentration_amount: number | null;
    dose_unit: string;
    per_unit: string;
    default_route: MedRoute;
    splittable_into: number;
    notes: string | null;
  };
  dose: DoseSuggestion | null;
};

type SuggestionResponse = {
  cat: { id: string; name: string };
  sickness: { id: string; name: string; description: string | null };
  weight: { weight_kg: number; recorded_at: string } | null;
  suggestions: Suggestion[];
};

async function fetchSicknesses(): Promise<Sickness[]> {
  const r = await fetch('/api/sicknesses', { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).sicknesses;
}

async function fetchSuggestions(catId: string, sicknessId: string): Promise<SuggestionResponse> {
  const r = await fetch(`/api/cats/${catId}/medication-suggestions?sickness_id=${sicknessId}`, {
    cache: 'no-store'
  });
  if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
  return r.json();
}

export function SuggestMedicationModal({
  open,
  onClose,
  catId
}: {
  open: boolean;
  onClose: () => void;
  catId: string;
}) {
  const t = useTranslations('medicationSuggest');
  const tm = useTranslations('medicationNotes');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const [sicknessId, setSicknessId] = useState<string>('');

  const { data: sicknesses = [] } = useQuery({
    queryKey: ['sicknesses', false],
    queryFn: fetchSicknesses,
    enabled: open
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['medication-suggestions', catId, sicknessId],
    queryFn: () => fetchSuggestions(catId, sicknessId),
    enabled: open && !!sicknessId
  });

  const schedule = useMutation({
    mutationFn: async (s: Suggestion) => {
      const today = new Date().toISOString().slice(0, 10);
      const end = (() => {
        const d = new Date();
        d.setDate(d.getDate() + (s.duration_days ?? 7) - 1);
        return d.toISOString().slice(0, 10);
      })();
      const r = await fetch(`/api/cats/${catId}/medications`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          medicine_name: s.template.brand
            ? `${s.template.name} (${s.template.brand})`
            : s.template.name,
          dose: doseString(s),
          route: s.template.default_route,
          start_date: today,
          end_date: end,
          interval_days: 1,
          time_slots: defaultSlots(s.frequency),
          notes: composeNotes(s)
        })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('scheduled'));
      qc.invalidateQueries({ queryKey: ['medications', catId] });
      qc.invalidateQueries({ queryKey: ['me-tasks'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  function handleClose() {
    setSicknessId('');
    onClose();
  }

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !o && handleClose()} title={t('title')}>
      <div className="space-y-4 py-2">
        <div className="space-y-1.5">
          <Label>{t('pickSickness')}</Label>
          <Select value={sicknessId} onValueChange={setSicknessId}>
            <SelectTrigger><SelectValue placeholder={t('pickPlaceholder')} /></SelectTrigger>
            <SelectContent>
              {sicknesses.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {sicknessId && (
          <div className="space-y-3">
            {isLoading && (
              <p className="text-sm text-muted-foreground">{tc('loading')}</p>
            )}
            {error && (
              <p className="text-sm text-destructive">{(error as Error).message}</p>
            )}
            {data && (
              <>
                <WeightBanner weight={data.weight} hasPerKg={data.suggestions.some((s) => s.rule.dose_per_kg != null)} />
                {data.suggestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('noSuggestions')}</p>
                ) : (
                  <ul className="space-y-2">
                    {data.suggestions.map((s) => (
                      <SuggestionRow
                        key={s.link_id}
                        suggestion={s}
                        onSchedule={() => schedule.mutate(s)}
                        scheduling={schedule.isPending}
                      />
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>{tc('close')}</Button>
        </div>
      </div>

      {/* Cross-linking hint to admin page */}
      <p className="mt-2 text-xs text-muted-foreground">
        {t('manageHint')}{' '}
        <a className="underline hover:no-underline" href="/medication-notes">
          {tm('title')}
        </a>
        .
      </p>
    </ResponsiveModal>
  );
}

function WeightBanner({
  weight,
  hasPerKg
}: {
  weight: SuggestionResponse['weight'];
  hasPerKg: boolean;
}) {
  const t = useTranslations('medicationSuggest');
  if (!weight) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          {hasPerKg ? t('noWeightWarning') : t('noWeightFlat')}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 text-xs">
      <Scale className="h-3.5 w-3.5 text-muted-foreground" />
      <span>
        {t('latestWeight', {
          kg: weight.weight_kg,
          date: new Date(weight.recorded_at).toLocaleDateString()
        })}
      </span>
    </div>
  );
}

function SuggestionRow({
  suggestion,
  onSchedule,
  scheduling
}: {
  suggestion: Suggestion;
  onSchedule: () => void;
  scheduling: boolean;
}) {
  const t = useTranslations('medicationSuggest');
  const tm = useTranslations('medicationNotes');
  const { template, dose } = suggestion;

  return (
    <li className="rounded-md border p-3 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 font-medium text-sm">
            <Pill className="h-3.5 w-3.5 text-violet-500" />
            <span className="truncate">{template.name}</span>
            {template.brand && (
              <span className="text-xs text-muted-foreground">· {template.brand}</span>
            )}
            <Badge variant="secondary">{tm(`forms.${template.form}`)}</Badge>
            {suggestion.priority > 1 && (
              <Badge variant="outline">{tm('links.alt', { n: suggestion.priority })}</Badge>
            )}
          </div>
          {(suggestion.frequency || suggestion.duration_days != null) && (
            <div className="text-xs text-muted-foreground">
              {[
                suggestion.frequency,
                suggestion.duration_days != null
                  ? tm('links.durationDays', { n: suggestion.duration_days })
                  : null
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}
        </div>
        <Button size="sm" onClick={onSchedule} disabled={scheduling || !dose}>
          {t('addAsSchedule')} <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Dose readout */}
      {dose ? (
        <DoseReadout dose={dose} suggestion={suggestion} />
      ) : (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {t('cannotCompute')}
        </p>
      )}

      {(suggestion.notes || template.notes) && (
        <p className="text-xs italic text-muted-foreground">
          {[suggestion.notes, template.notes].filter(Boolean).join(' · ')}
        </p>
      )}
    </li>
  );
}

function DoseReadout({
  dose,
  suggestion
}: {
  dose: DoseSuggestion;
  suggestion: Suggestion;
}) {
  const t = useTranslations('medicationSuggest');
  const tm = useTranslations('medicationNotes');

  // Primary dose number — always show the active-ingredient dose so admins
  // can sanity-check the calculation.
  const doseLine = `${trim(dose.dose_amount)} ${dose.dose_unit}`;
  const basisHint =
    dose.basis === 'flat'
      ? t('basis.flat')
      : dose.basis === 'per_kg_clamped_min'
      ? t('basis.clampedMin', {
          dose: trim(suggestion.rule.dose_per_kg ?? 0),
          unit: dose.dose_unit,
          min: trim(suggestion.rule.min_dose ?? 0)
        })
      : dose.basis === 'per_kg_clamped_max'
      ? t('basis.clampedMax', {
          dose: trim(suggestion.rule.dose_per_kg ?? 0),
          unit: dose.dose_unit,
          max: trim(suggestion.rule.max_dose ?? 0)
        })
      : t('basis.perKg', {
          dose: trim(suggestion.rule.dose_per_kg ?? 0),
          unit: dose.dose_unit
        });

  return (
    <div className="rounded-md bg-violet-50 p-2 text-sm dark:bg-violet-950/30">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-semibold text-violet-900 dark:text-violet-100">
          {doseLine}
        </span>
        {dose.amount_rounded != null && (
          <span className="text-violet-800 dark:text-violet-200">
            ≈ {formatAmount(dose.amount_rounded, dose.per_unit)}
          </span>
        )}
        {dose.amount == null && !suggestion.template.concentration_amount && (
          <span className="text-xs text-muted-foreground">{t('rawDoseOnly')}</span>
        )}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{basisHint}</div>
      {!dose.precise && dose.amount_rounded != null && (
        <div className="mt-1 flex items-start gap-1 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>
            {dose.rounding_warning
              ? t('roundedHeavyWarning', {
                  exact: trim(dose.amount ?? 0),
                  rounded: trim(dose.amount_rounded),
                  unit: dose.per_unit
                })
              : tm(`forms.${dose.form}`) + ' — ' + t('roundedHint')}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────
function trim(n: number): string {
  return Number(n.toFixed(4)).toString();
}

// Build the free-text dose stored on the medications row. Prefers the
// administration amount (e.g. "0.5 ml") because that's what the sitter
// actually measures, with the active-ingredient dose in parentheses.
function doseString(s: Suggestion): string {
  if (!s.dose) return '';
  const active = `${trim(s.dose.dose_amount)} ${s.dose.dose_unit}`;
  if (s.dose.amount_rounded != null) {
    return `${formatAmount(s.dose.amount_rounded, s.dose.per_unit)} (${active})`;
  }
  return active;
}

// next-intl message used after the slot bullet — these are stored as `text[]`
// in HH:MM. We default to once-daily morning unless the freq looks 2x/day.
function defaultSlots(frequency: string | null): string[] {
  if (!frequency) return ['08:00'];
  const f = frequency.toLowerCase();
  if (f.includes('bid') || f.includes('2x') || f.includes('twice') || f.includes('12h')) {
    return ['08:00', '20:00'];
  }
  if (f.includes('tid') || f.includes('3x') || f.includes('thrice') || f.includes('8h')) {
    return ['08:00', '14:00', '20:00'];
  }
  if (f.includes('qid') || f.includes('4x') || f.includes('6h')) {
    return ['06:00', '12:00', '18:00', '00:00'];
  }
  return ['08:00'];
}

function composeNotes(s: Suggestion): string {
  const parts: string[] = [];
  if (s.frequency) parts.push(s.frequency);
  if (s.notes) parts.push(s.notes);
  if (s.template.notes) parts.push(s.template.notes);
  return parts.join(' · ');
}
