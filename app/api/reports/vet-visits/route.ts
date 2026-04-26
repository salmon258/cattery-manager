import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

/**
 * GET /api/reports/vet-visits
 * Admin only. Vet visits with cost totals, filterable by date/cat.
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
    .from('vet_visits')
    .select(`
      id, cat_id, visit_date, visit_type, status, diagnosis, visit_cost, transport_cost,
      cat:cats(id, name),
      clinic:clinics(id, name),
      doctor:doctors(id, full_name)
    `)
    .order('visit_date', { ascending: false });

  if (from)  q = q.gte('visit_date', from);
  if (to)    q = q.lte('visit_date', to);
  if (catId) q = q.eq('cat_id', catId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totals = (data ?? []).reduce((acc, v) => ({
    visit:     acc.visit     + Number(v.visit_cost     ?? 0),
    transport: acc.transport + Number(v.transport_cost ?? 0)
  }), { visit: 0, transport: 0 });

  return NextResponse.json({ rows: data ?? [], totals });
}
