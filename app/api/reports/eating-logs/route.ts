import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

/**
 * GET /api/reports/eating-logs
 * Admin only. Eating sessions with their items in the date range.
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .from('eating_logs')
    .select(`
      id, cat_id, meal_time, feeding_method, notes,
      cat:cats(id, name),
      submitter:profiles!eating_logs_submitted_by_fkey(id, full_name),
      items:eating_log_items(
        id, quantity_given_g, quantity_eaten, estimated_kcal_consumed,
        food:food_items(id, name, brand, type)
      )
    `)
    .order('meal_time', { ascending: false });

  if (from)  q = q.gte('meal_time', from);
  if (to)    q = q.lte('meal_time', `${to}T23:59:59`);
  if (catId) q = q.eq('cat_id', catId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}
