import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { roomUpdateSchema } from '@/lib/schemas/rooms';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', params.id)
    .single();
  if (error || !room) return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 404 });

  // Current occupants (any status — UI can filter)
  const { data: occupants } = await supabase
    .from('cats')
    .select('id, name, profile_photo_url, status, breed, assignee_id')
    .eq('current_room_id', params.id)
    .order('name', { ascending: true });

  // Movement history (most recent first)
  const { data: movements } = await supabase
    .from('room_movements')
    .select('*')
    .or(`from_room_id.eq.${params.id},to_room_id.eq.${params.id}`)
    .order('moved_at', { ascending: false })
    .limit(200);

  return NextResponse.json({
    room,
    occupants: occupants ?? [],
    movements: movements ?? []
  });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = roomUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('rooms')
    .update(parsed.data)
    .eq('id', params.id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ room: data });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createClient();

  // Refuse to soft-delete if any active cat is currently in this room
  const { count: occCount, error: occErr } = await supabase
    .from('cats')
    .select('id', { count: 'exact', head: true })
    .eq('current_room_id', params.id);
  if (occErr) return NextResponse.json({ error: occErr.message }, { status: 500 });
  if ((occCount ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Room still has occupants. Move cats out first.' },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from('rooms')
    .update({ is_active: false })
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
