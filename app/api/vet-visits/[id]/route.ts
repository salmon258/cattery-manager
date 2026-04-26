import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { vetVisitUpdateSchema } from '@/lib/schemas/vet';
import type { Database } from '@/lib/supabase/types';

type VetVisitUpdate = Database['public']['Tables']['vet_visits']['Update'];

/**
 * GET /api/vet-visits/[id]
 * Full visit detail including medicines and lab results.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('vet_visits')
    .select(`
      *,
      cat:cats(id, name, profile_photo_url),
      clinic:clinics(id, name, phone, address),
      doctor:doctors(id, full_name, specialisation, phone),
      creator:profiles!vet_visits_created_by_fkey(id, full_name),
      medicines:vet_visit_medicines(id, medicine_name, dose, frequency, duration, notes),
      lab_results(id, file_url, file_name, file_type, file_size_bytes, kind, notes, uploaded_at,
                  uploader:profiles!lab_results_uploaded_by_fkey(id, full_name)),
      health_ticket:health_tickets(id, title, status)
    `)
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ visit: data });
}

/**
 * PATCH /api/vet-visits/[id] — admin only
 *
 * Updates the visit fields. If `medicines` is provided, it fully replaces
 * the current medicine list (including any auto-schedules generated on the
 * previous list). Lab results and receipts are managed via their own
 * endpoint and are not touched here.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body   = await req.json();
  const parsed = vetVisitUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();
  const { medicines, follow_up_date, ...visitFields } = parsed.data;

  // Build the update patch: only include fields that were actually sent so we
  // don't accidentally null out columns the caller didn't touch.
  const patch: VetVisitUpdate = { ...visitFields };
  if (follow_up_date !== undefined) {
    patch.follow_up_date = follow_up_date || null;
  }

  if (Object.keys(patch).length > 0) {
    const { error: updErr } = await supabase
      .from('vet_visits')
      .update(patch)
      .eq('id', params.id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // Replace medicines if provided. We drop all existing rows first and also
  // delete any medications auto-generated from them so the new list owns the
  // schedule tree cleanly.
  if (medicines !== undefined) {
    // Need the cat id up-front to create any new schedules that were added.
    const { data: visitCat, error: visitLookupErr } = await supabase
      .from('vet_visits')
      .select('cat_id')
      .eq('id', params.id)
      .single();
    if (visitLookupErr || !visitCat) {
      return NextResponse.json({ error: visitLookupErr?.message ?? 'Visit not found' }, { status: 404 });
    }
    const catId: string = visitCat.cat_id;

    // Find existing generated medications linked to this visit so we can drop
    // them alongside their vet_visit_medicines parent rows.
    const { data: existing } = await supabase
      .from('vet_visit_medicines')
      .select('generated_medication_id')
      .eq('vet_visit_id', params.id);
    const linkedMedIds = (existing ?? [])
      .map((r: { generated_medication_id: string | null }) => r.generated_medication_id)
      .filter((id: string | null): id is string => !!id);

    const { error: delErr } = await supabase
      .from('vet_visit_medicines')
      .delete()
      .eq('vet_visit_id', params.id);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    if (linkedMedIds.length > 0) {
      await supabase.from('medications').delete().in('id', linkedMedIds);
    }

    // Re-insert with the same logic as POST.
    for (const m of medicines) {
      let generated_medication_id: string | null = null;

      if (m.schedule_enabled) {
        const dose = (m.dose ?? '').trim();
        if (!dose) {
          return NextResponse.json(
            { error: `Medication "${m.medicine_name}" needs a dose to be scheduled.` },
            { status: 400 }
          );
        }
        // schedule_enabled=true is gated by the zod refine, which guarantees
        // schedule_start_date and schedule_time_slots are set.
        const { data: medRow, error: medCreateErr } = await supabase
          .from('medications')
          .insert({
            cat_id:        catId,
            medicine_name: m.medicine_name,
            dose,
            route:         m.schedule_route ?? 'oral',
            start_date:    m.schedule_start_date!,
            end_date:      m.schedule_end_date ?? null,
            interval_days: m.schedule_interval_days ?? 1,
            time_slots:    m.schedule_time_slots!,
            notes:         m.notes ?? null,
            is_active:     true,
            created_by:    user.profile.id
          })
          .select('id')
          .single();
        if (medCreateErr) return NextResponse.json({ error: medCreateErr.message }, { status: 500 });
        generated_medication_id = medRow.id;
      }

      const { error: insErr } = await supabase
        .from('vet_visit_medicines')
        .insert({
          vet_visit_id:           params.id,
          medicine_name:          m.medicine_name,
          dose:                   m.dose ?? null,
          frequency:              m.frequency ?? null,
          duration:               m.duration ?? null,
          notes:                  m.notes ?? null,
          schedule_enabled:       m.schedule_enabled,
          schedule_start_date:    m.schedule_enabled ? m.schedule_start_date    ?? null : null,
          schedule_end_date:      m.schedule_enabled ? m.schedule_end_date      ?? null : null,
          schedule_interval_days: m.schedule_enabled ? m.schedule_interval_days ?? 1    : null,
          schedule_time_slots:    m.schedule_enabled ? m.schedule_time_slots    ?? null : null,
          schedule_route:         m.schedule_enabled ? m.schedule_route         ?? 'oral' : null,
          generated_medication_id
        });
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  // Return the refreshed visit.
  const { data: refreshed } = await supabase
    .from('vet_visits')
    .select('*')
    .eq('id', params.id)
    .single();

  return NextResponse.json({ visit: refreshed });
}

/**
 * DELETE /api/vet-visits/[id] — admin only
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createClient();
  const { error } = await supabase
    .from('vet_visits')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
