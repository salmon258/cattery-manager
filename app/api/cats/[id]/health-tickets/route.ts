import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { createTicketSchema } from '@/lib/schemas/health-tickets';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('health_tickets')
    .select(
      `*, creator:profiles!health_tickets_created_by_fkey(id, full_name),
       resolver:profiles!health_tickets_resolved_by_fkey(id, full_name)`
    )
    .eq('cat_id', params.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tickets: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const body = await req.json();
  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('health_tickets')
    .insert({
      cat_id:      params.id,
      title:       parsed.data.title,
      description: parsed.data.description ?? null,
      severity:    parsed.data.severity,
      created_by:  user.profile.id
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach photos (ticket-level, event_id = null)
  const photoUrls = parsed.data.photo_urls ?? [];
  if (photoUrls.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('health_ticket_photos')
      .insert(
        photoUrls.map((url: string) => ({
          ticket_id:    data.id,
          event_id:     null,
          url,
          storage_path: new URL(url).pathname,
          created_by:   user.profile.id
        }))
      );
  }

  return NextResponse.json({ ticket: data }, { status: 201 });
}
