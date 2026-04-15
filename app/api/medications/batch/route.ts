import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { batchCreateMedicationsSchema } from '@/lib/schemas/medications';

/**
 * POST /api/medications/batch
 * Admin-only — insert the same medication schedule for many cats at once.
 * Body: { cat_ids: string[], medication: MedicationInput }
 *
 * One row is inserted per cat so the existing `regenerate_medication_tasks`
 * trigger fires per-schedule and produces the correct dose tasks for each cat.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = batchCreateMedicationsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { cat_ids, medication } = parsed.data;
  const supabase = createClient();

  // Guard against cat ids that don't exist (or the admin can't see) so we don't
  // silently create schedules against ghost ids. RLS already handles this at the
  // insert level, but a pre-check gives a clearer error message to the UI.
  const { data: existingCats, error: catErr } = await supabase
    .from('cats')
    .select('id')
    .in('id', cat_ids);
  if (catErr) return NextResponse.json({ error: catErr.message }, { status: 500 });

  const foundIds = new Set((existingCats ?? []).map((c) => c.id));
  const missing  = cat_ids.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Unknown cat ids: ${missing.join(', ')}` },
      { status: 400 }
    );
  }

  const rows = cat_ids.map((catId) => ({
    cat_id: catId,
    medicine_name: medication.medicine_name,
    dose: medication.dose,
    route: medication.route,
    start_date: medication.start_date,
    end_date: medication.end_date,
    interval_days: medication.interval_days,
    time_slots: medication.time_slots,
    notes: medication.notes ?? null,
    is_active: medication.is_active ?? true,
    created_by: user.authId
  }));

  const { data, error } = await supabase
    .from('medications')
    .insert(rows)
    .select('id, cat_id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ created: data?.length ?? 0 }, { status: 201 });
}
