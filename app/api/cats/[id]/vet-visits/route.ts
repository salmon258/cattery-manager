import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { vetVisitSchema } from '@/lib/schemas/vet';

/**
 * GET /api/cats/[id]/vet-visits
 * All authenticated users — list all vet visits for a cat.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('vet_visits')
    .select(`
      *,
      clinic:clinics(id, name),
      doctor:doctors(id, full_name, specialisation),
      creator:profiles!vet_visits_created_by_fkey(id, full_name),
      medicines:vet_visit_medicines(
        id, medicine_name, dose, frequency, duration, notes,
        schedule_enabled, generated_medication_id
      ),
      lab_results(id, file_url, file_name, file_type, kind, notes, uploaded_at),
      health_ticket:health_tickets(id, title, status)
    `)
    .eq('cat_id', params.id)
    .order('visit_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ visits: data ?? [] });
}

/**
 * POST /api/cats/[id]/vet-visits
 * All authenticated users — create a vet visit record for a cat.
 *
 * Side-effects:
 *   1. Creates vet_visit row
 *   2. Creates vet_visit_medicines rows if provided. For any medicine row with
 *      schedule_enabled = true (admin only), also creates a medications row +
 *      generates daily tasks via the existing trigger.
 *   3. If health_ticket_id set: inserts a 'vet_referral' event on the ticket thread
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const body   = await req.json();
  const parsed = vetVisitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();
  const { medicines, follow_up_date, ...visitFields } = parsed.data;
  const isAdmin = user.profile.role === 'admin';

  // 1. Insert vet_visit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: visit, error: visitErr } = await (supabase as any)
    .from('vet_visits')
    .insert({
      ...visitFields,
      cat_id:         params.id,
      follow_up_date: follow_up_date || null,
      created_by:     user.profile.id
    })
    .select('*')
    .single();

  if (visitErr) return NextResponse.json({ error: visitErr.message }, { status: 500 });

  // 2. Insert medicines + (optionally) auto-create medication schedules
  for (const m of medicines) {
    let generated_medication_id: string | null = null;

    // Auto-create the medication schedule first so we have its id to link.
    // Only admins can create schedules (matches the existing /api/cats/[id]/medications RLS).
    if (m.schedule_enabled && isAdmin) {
      const dose = (m.dose ?? '').trim();
      if (!dose) {
        return NextResponse.json(
          { error: `Medication "${m.medicine_name}" needs a dose to be scheduled.` },
          { status: 400 }
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: medRow, error: medCreateErr } = await (supabase as any)
        .from('medications')
        .insert({
          cat_id:        params.id,
          medicine_name: m.medicine_name,
          dose,
          route:         m.schedule_route ?? 'oral',
          start_date:    m.schedule_start_date,
          end_date:      m.schedule_end_date,
          interval_days: m.schedule_interval_days ?? 1,
          time_slots:    m.schedule_time_slots,
          notes:         m.notes ?? null,
          is_active:     true,
          created_by:    user.profile.id
        })
        .select('id')
        .single();
      if (medCreateErr) return NextResponse.json({ error: medCreateErr.message }, { status: 500 });
      generated_medication_id = medRow.id;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insErr } = await (supabase as any)
      .from('vet_visit_medicines')
      .insert({
        vet_visit_id:           visit.id,
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

  // 3. Ticket integration: vet_referral event
  if (visitFields.health_ticket_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('health_ticket_events')
      .insert({
        ticket_id:           visitFields.health_ticket_id,
        event_type:          'vet_referral',
        note:                visitFields.diagnosis || visitFields.chief_complaint || null,
        linked_vet_visit_id: visit.id,
        created_by:          user.profile.id
      });
  }

  return NextResponse.json({ visit }, { status: 201 });
}
