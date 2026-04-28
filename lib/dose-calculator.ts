import type { MedicationForm } from '@/lib/supabase/aliases';

/**
 * Suggested dose for a single sickness↔medication pairing, given a cat's
 * latest weight. The calculation has two layers:
 *
 *  1. Compute the desired *active-ingredient dose* (in `dose_unit` — mg by
 *     default). Per-kg rules multiply by weight; flat doses bypass weight.
 *     Optional min/max clamps the result.
 *
 *  2. Convert that dose into an *administration amount* (in `per_unit` —
 *     ml, tablet, capsule, …) using the template's concentration.
 *
 * Why we can't always give an exact number: tablets/capsules can only be
 * split into halves or quarters at best, so the result has to be rounded.
 * Topicals/"other" don't expose a concentration, so we return `null` for
 * the amount and the UI falls back to the raw dose.
 */
export type DoseInputs = {
  weight_kg: number | null;
  rule: {
    dose_per_kg: number | null;
    flat_dose: number | null;
    min_dose: number | null;
    max_dose: number | null;
  };
  template: {
    form: MedicationForm;
    concentration_amount: number | null;
    dose_unit: string;
    per_unit: string;
    splittable_into: number;
  };
};

export type DoseSuggestion = {
  /** Dose of the active ingredient (e.g. "12.5 mg"). */
  dose_amount: number;
  dose_unit: string;
  /** How that was derived for the UI to explain. */
  basis: 'per_kg' | 'flat' | 'per_kg_clamped_min' | 'per_kg_clamped_max';
  /** Administration amount in `per_unit` (e.g. "0.25 ml" or "0.5 tablet"). */
  amount: number | null;
  /** Same number rounded to what's safely splittable in this form. */
  amount_rounded: number | null;
  per_unit: string;
  form: MedicationForm;
  /** True when the form can be precisely measured by weight (liquids/injections). */
  precise: boolean;
  /** True when rounding changed the dose meaningfully (>5%). */
  rounding_warning: boolean;
};

const FORMS_WITH_PRECISE_VOLUME: MedicationForm[] = ['liquid', 'injection'];
// Drops/powder/sachet etc. have a per-unit measure but you can't split a drop
// — they're treated as count-only.
const FORMS_WITH_NO_AMOUNT: MedicationForm[] = ['topical', 'other'];

export function calculateDose({ weight_kg, rule, template }: DoseInputs): DoseSuggestion | null {
  // 1. Desired active-ingredient dose
  let doseAmount: number;
  let basis: DoseSuggestion['basis'];
  if (rule.flat_dose != null) {
    doseAmount = rule.flat_dose;
    basis = 'flat';
  } else if (rule.dose_per_kg != null && weight_kg != null && weight_kg > 0) {
    doseAmount = rule.dose_per_kg * weight_kg;
    basis = 'per_kg';
  } else {
    // Per-kg rule but no weight on file — can't suggest.
    return null;
  }

  // Clamp to min/max if set.
  if (rule.min_dose != null && doseAmount < rule.min_dose) {
    doseAmount = rule.min_dose;
    basis = basis === 'per_kg' ? 'per_kg_clamped_min' : basis;
  }
  if (rule.max_dose != null && doseAmount > rule.max_dose) {
    doseAmount = rule.max_dose;
    basis = basis === 'per_kg' ? 'per_kg_clamped_max' : basis;
  }

  // 2. Administration amount
  let amount: number | null = null;
  let amountRounded: number | null = null;
  let roundingWarning = false;
  const precise = FORMS_WITH_PRECISE_VOLUME.includes(template.form);

  if (
    !FORMS_WITH_NO_AMOUNT.includes(template.form) &&
    template.concentration_amount != null &&
    template.concentration_amount > 0
  ) {
    amount = doseAmount / template.concentration_amount;
    if (precise) {
      // Liquids: round to 2 decimals (0.01 ml). No splittable concept.
      amountRounded = Math.round(amount * 100) / 100;
    } else {
      // Tablets/capsules: round to nearest fraction allowed.
      const denom = Math.max(1, template.splittable_into);
      amountRounded = Math.round(amount * denom) / denom;
      // Flag when rounding shifts the dose by more than 5%.
      if (amountRounded > 0 && Math.abs(amountRounded - amount) / amount > 0.05) {
        roundingWarning = true;
      }
    }
  }

  return {
    dose_amount: round(doseAmount, 4),
    dose_unit: template.dose_unit,
    basis,
    amount: amount == null ? null : round(amount, 4),
    amount_rounded: amountRounded,
    per_unit: template.per_unit,
    form: template.form,
    precise,
    rounding_warning: roundingWarning
  };
}

function round(n: number, decimals: number) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** Format the rounded amount the way a user would speak it (½ tablet, 1¼ tablet). */
export function formatAmount(amount: number, perUnit: string): string {
  const whole = Math.floor(amount);
  const frac = amount - whole;
  let fracPart = '';
  if (Math.abs(frac - 0.25) < 0.001) fracPart = '¼';
  else if (Math.abs(frac - 0.5) < 0.001) fracPart = '½';
  else if (Math.abs(frac - 0.75) < 0.001) fracPart = '¾';

  if (fracPart) {
    const head = whole > 0 ? `${whole}${fracPart}` : fracPart;
    return `${head} ${perUnit}`;
  }
  // Drop trailing zeros after rounding.
  const num = Number(amount.toFixed(2)).toString();
  return `${num} ${perUnit}`;
}
