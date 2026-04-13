import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { roomSchema } from '@/lib/schemas/rooms';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();
  const url = new URL(request.url);
  const includeInactive = url.searchParams.get('include_inactive') === '1';

  let query = supabase.from('rooms').select('*').order('name', { ascending: true });
  if (!includeInactive) query = query.eq('is_active', true);

  const { data: rooms, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach occupant counts (single round-trip: count active cats per room).
  const { data: occupantRows, error: occErr } = await supabase
    .from('cats')
    .select('current_room_id')
    .not('current_room_id', 'is', null)
    .eq('status', 'active');
  if (occErr) return NextResponse.json({ error: occErr.message }, { status: 500 });

  const counts = new Map<string, number>();
  for (const row of occupantRows ?? []) {
    if (!row.current_room_id) continue;
    counts.set(row.current_room_id, (counts.get(row.current_room_id) ?? 0) + 1);
  }

  const withCounts = (rooms ?? []).map((r) => ({ ...r, occupant_count: counts.get(r.id) ?? 0 }));
  return NextResponse.json({ rooms: withCounts });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = roomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('rooms')
    .insert({ ...parsed.data, created_by: user.authId })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ room: data }, { status: 201 });
}
