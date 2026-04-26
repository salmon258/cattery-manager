import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

/**
 * GET /api/health-tickets/[id]
 * Returns the ticket with its full event thread (ordered oldest → newest).
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('health_tickets')
    .select(
      `*,
       cat:cats(id, name),
       creator:profiles!health_tickets_created_by_fkey(id, full_name),
       resolver:profiles!health_tickets_resolved_by_fkey(id, full_name),
       photos:health_ticket_photos(id, url, event_id),
       events:health_ticket_events(
         *,
         author:profiles!health_ticket_events_created_by_fkey(id, full_name),
         linked_visit:vet_visits!health_ticket_events_linked_vet_visit_fkey(
           id, visit_date, visit_type, diagnosis, chief_complaint, visit_cost,
           clinic:clinics(id, name),
           doctor:doctors(id, full_name)
         )
       )`
    )
    .eq('id', params.id)
    .order('created_at', { ascending: true, referencedTable: 'health_ticket_events' })
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ ticket: data });
}
