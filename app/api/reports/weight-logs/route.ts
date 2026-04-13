import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

/**
 * GET /api/reports/weight-logs
 * Admin only. Returns weight logs grouped by cat for the given date range.
 * Query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD&cat_id=
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
    .from('weight_logs')
    .select(`
      id, cat_id, weight_kg, recorded_at, notes,
      cat:cats(id, name),
      submitter:profiles!weight_logs_submitted_by_fkey(id, full_name)
    `)
    .order('recorded_at', { ascending: false });

  if (from)  q = q.gte('recorded_at', from);
  if (to)    q = q.lte('recorded_at', `${to}T23:59:59`);
  if (catId) q = q.eq('cat_id', catId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}
