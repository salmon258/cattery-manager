import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

/**
 * GET /api/reports/vaccinations
 * Admin only. All vaccination records; flags overdue based on next_due_date.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url  = new URL(req.url);
  const from = url.searchParams.get('from');
  const to   = url.searchParams.get('to');

  const supabase = createClient();
  let q = supabase
    .from('vaccinations')
    .select(`
      id, cat_id, vaccine_type, vaccine_name, administered_date, next_due_date, notes,
      cat:cats(id, name)
    `)
    .order('administered_date', { ascending: false });

  if (from) q = q.gte('administered_date', from);
  if (to)   q = q.lte('administered_date', to);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const todayStr = new Date().toISOString().slice(0, 10);
  const rows = (data ?? []).map((v) => ({
    ...v,
    given_date: v.administered_date,
    overdue: v.next_due_date ? v.next_due_date < todayStr : false
  }));

  return NextResponse.json({ rows });
}
