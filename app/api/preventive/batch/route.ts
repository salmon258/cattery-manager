import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { batchCreatePreventiveSchema } from '@/lib/schemas/preventive';

/**
 * POST /api/preventive/batch
 * Admin-only — record the same deworming / flea / combined treatment for many
 * cats at once.
 * Body: { cat_ids: string[], treatment: PreventiveTreatmentInput }
 *
 * One row is inserted per cat so each cat keeps its own independent due-date
 * timeline and audit trail; downstream views (cards, reports, dashboard) read
 * per-cat and need rows to live under their respective cat_id.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = batchCreatePreventiveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { cat_ids, treatment } = parsed.data;
  const supabase = createClient();

  // Surface unknown cat ids with a clear error rather than letting RLS silently
  // drop them — gives the admin confidence about what was actually written.
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
    treatment_type: treatment.treatment_type,
    product_name: treatment.product_name,
    administered_date: treatment.administered_date,
    next_due_date: treatment.next_due_date || null,
    notes: treatment.notes ?? null,
    recorded_by: user.authId
  }));

  const { data, error } = await supabase
    .from('preventive_treatments')
    .insert(rows)
    .select('id, cat_id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ created: data?.length ?? 0 }, { status: 201 });
}
