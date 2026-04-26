import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

/**
 * GET /api/reports/room-movements
 * Admin only. Full room movement audit trail.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url   = new URL(req.url);
  const from  = url.searchParams.get('from');
  const to    = url.searchParams.get('to');
  const catId = url.searchParams.get('cat_id');

  const supabase = createClient();
  let q = supabase
    .from('room_movements')
    .select(`
      id, cat_id, from_room_id, to_room_id, moved_at, reason,
      cat:cats(id, name),
      from_room:rooms!from_room_id(id, name),
      to_room:rooms!to_room_id(id, name),
      mover:profiles!moved_by(id, full_name)
    `)
    .order('moved_at', { ascending: false });

  if (from)  q = q.gte('moved_at', from);
  if (to)    q = q.lte('moved_at', `${to}T23:59:59`);
  if (catId) q = q.eq('cat_id', catId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}
