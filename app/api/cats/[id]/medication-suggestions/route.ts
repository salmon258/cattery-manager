import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { calculateDose, type DoseSuggestion } from '@/lib/dose-calculator';
import type { MedicationForm, MedRoute } from '@/lib/supabase/aliases';

/**
 * GET /api/cats/[id]/medication-suggestions?sickness_id=…
 *
 * Pull the cat's latest weight + every sickness↔medication rule, and run
 * the dose calculator for each so the UI can render a ready-to-confirm list.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const url = new URL(request.url);
  const sicknessId = url.searchParams.get('sickness_id');
  if (!sicknessId) return NextResponse.json({ error: 'sickness_id is required' }, { status: 400 });

  const supabase = createClient();

  const [catResult, weightResult, linksResult, sicknessResult] = await Promise.all([
    supabase.from('cats').select('id, name').eq('id', params.id).single(),
    supabase.from('cat_latest_weight').select('weight_kg, recorded_at').eq('cat_id', params.id).maybeSingle(),
    supabase
      .from('sickness_medications')
      .select('*, template:medication_templates(*)')
      .eq('sickness_id', sicknessId)
      .order('priority', { ascending: true }),
    supabase.from('sicknesses').select('id, name, description').eq('id', sicknessId).single()
  ]);

  if (catResult.error || !catResult.data) {
    return NextResponse.json({ error: catResult.error?.message ?? 'Cat not found' }, { status: 404 });
  }
  if (sicknessResult.error || !sicknessResult.data) {
    return NextResponse.json({ error: sicknessResult.error?.message ?? 'Sickness not found' }, { status: 404 });
  }

  const weightKg = weightResult.data?.weight_kg ?? null;
  const recordedAt = weightResult.data?.recorded_at ?? null;
  const links = (linksResult.data ?? []) as Array<{
    id: string;
    medication_template_id: string;
    dose_per_kg: number | null;
    flat_dose: number | null;
    min_dose: number | null;
    max_dose: number | null;
    frequency: string | null;
    duration_days: number | null;
    priority: number;
    notes: string | null;
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
      is_active: boolean;
    } | null;
  }>;

  const suggestions = links
    .filter((l) => l.template && l.template.is_active)
    .map((link) => {
      const template = link.template!;
      const dose: DoseSuggestion | null = calculateDose({
        weight_kg: weightKg,
        rule: {
          dose_per_kg: link.dose_per_kg,
          flat_dose: link.flat_dose,
          min_dose: link.min_dose,
          max_dose: link.max_dose
        },
        template: {
          form: template.form,
          concentration_amount: template.concentration_amount,
          dose_unit: template.dose_unit,
          per_unit: template.per_unit,
          splittable_into: template.splittable_into
        }
      });
      return {
        link_id: link.id,
        priority: link.priority,
        frequency: link.frequency,
        duration_days: link.duration_days,
        notes: link.notes,
        rule: {
          dose_per_kg: link.dose_per_kg,
          flat_dose: link.flat_dose,
          min_dose: link.min_dose,
          max_dose: link.max_dose
        },
        template: {
          id: template.id,
          name: template.name,
          brand: template.brand,
          form: template.form,
          concentration_amount: template.concentration_amount,
          dose_unit: template.dose_unit,
          per_unit: template.per_unit,
          default_route: template.default_route,
          splittable_into: template.splittable_into,
          notes: template.notes
        },
        dose
      };
    });

  return NextResponse.json({
    cat: catResult.data,
    sickness: sicknessResult.data,
    weight: weightKg == null ? null : { weight_kg: weightKg, recorded_at: recordedAt },
    suggestions
  });
}
