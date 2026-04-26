import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

/**
 * GET /api/reports/heat-logs
 * Admin only. All heat observations for female cats in date range.
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
    .from('heat_logs')
    .select(`
      id, cat_id, observed_date, intensity, notes,
      cat:cats(id, name),
      logger:profiles!heat_logs_logged_by_fkey(id, full_name)
    `)
    .order('observed_date', { ascending: false });

  if (from)  q = q.gte('observed_date', from);
  if (to)    q = q.lte('observed_date', to);
  if (catId) q = q.eq('cat_id', catId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}
