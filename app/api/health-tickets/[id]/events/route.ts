import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { addEventSchema } from '@/lib/schemas/health-tickets';
import type { Database } from '@/lib/supabase/types';

type HealthTicketUpdate = Database['public']['Tables']['health_tickets']['Update'];

/**
 * POST /api/health-tickets/[id]/events
 * Appends an event to the ticket thread.
 * Side effects:
 *   status_change → updates health_tickets.status
 *   resolved      → sets status=resolved, resolved_at, resolved_by, resolution_summary
 *   reopened      → sets status=open, clears resolution fields
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const body = await req.json();
  const parsed = addEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { event_type, note, new_status, resolution_summary, photo_urls } = parsed.data;
  const isAdmin = user.profile.role === 'admin';

  // Admin-only actions
  if (['status_change', 'resolved', 'reopened'].includes(event_type) && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Validate required fields per event type
  if (event_type === 'comment' && !note?.trim()) {
    return NextResponse.json({ error: 'note is required for comment' }, { status: 400 });
  }
  if (event_type === 'status_change' && !new_status) {
    return NextResponse.json({ error: 'new_status is required for status_change' }, { status: 400 });
  }
  if (event_type === 'resolved' && !resolution_summary?.trim()) {
    return NextResponse.json({ error: 'resolution_summary is required' }, { status: 400 });
  }

  const supabase = createClient();

  // Insert event record
  const { data: event, error: eventError } = await supabase
    .from('health_ticket_events')
    .insert({
      ticket_id:  params.id,
      event_type,
      note:       note ?? null,
      new_status: event_type === 'status_change' ? new_status : null,
      created_by: user.profile.id
    })
    .select()
    .single();

  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });

  // Attach photos to this event
  if (photo_urls && photo_urls.length > 0) {
    await supabase
      .from('health_ticket_photos')
      .insert(
        photo_urls.map((url: string) => ({
          ticket_id:    params.id,
          event_id:     event.id,
          url,
          storage_path: new URL(url).pathname,
          created_by:   user.profile.id
        }))
      );
  }

  // Side-effect: update ticket record
  const ticketUpdate: HealthTicketUpdate = {};
  if (event_type === 'status_change' && new_status) {
    ticketUpdate.status = new_status;
  } else if (event_type === 'resolved') {
    ticketUpdate.status             = 'resolved';
    ticketUpdate.resolved_at        = new Date().toISOString();
    ticketUpdate.resolved_by        = user.profile.id;
    ticketUpdate.resolution_summary = resolution_summary;
  } else if (event_type === 'reopened') {
    ticketUpdate.status             = 'open';
    ticketUpdate.resolved_at        = null;
    ticketUpdate.resolved_by        = null;
    ticketUpdate.resolution_summary = null;
  }

  if (Object.keys(ticketUpdate).length) {
    const { error: updateError } = await supabase
      .from('health_tickets')
      .update(ticketUpdate)
      .eq('id', params.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ event }, { status: 201 });
}
