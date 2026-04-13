import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

/**
 * GET /api/vet-visits/[id]
 * Full visit detail including medicines and lab results.
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
      cat:cats(id, name, profile_photo_url),
      clinic:clinics(id, name, phone, address),
      doctor:doctors(id, full_name, specialisation, phone),
      creator:profiles!vet_visits_created_by_fkey(id, full_name),
      medicines:vet_visit_medicines(id, medicine_name, dose, frequency, duration, notes),
      lab_results(id, file_url, file_name, file_type, file_size_bytes, notes, uploaded_at,
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
 * DELETE /api/vet-visits/[id] — admin only
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('vet_visits')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
