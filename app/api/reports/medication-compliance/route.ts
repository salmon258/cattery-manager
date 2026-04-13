import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

/**
 * GET /api/reports/medication-compliance
 * Admin only. Returns one row per medication plan with compliance counts.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url  = new URL(req.url);
  const from = url.searchParams.get('from');
  const to   = url.searchParams.get('to');

  const supabase = createClient();

  // Pull all medications in scope (active + inactive)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: meds, error: medErr } = await (supabase as any)
    .from('medications')
    .select(`
      id, medicine_name, dose, route, start_date, end_date, is_active,
      cat:cats(id, name)
    `)
    .order('start_date', { ascending: false });
  if (medErr) return NextResponse.json({ error: medErr.message }, { status: 500 });

  // Pull tasks in date range and group counts by medication_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let taskQ = (supabase as any)
    .from('medication_tasks')
    .select('medication_id, due_at, confirmed_at, skipped');
  if (from) taskQ = taskQ.gte('due_at', from);
  if (to)   taskQ = taskQ.lte('due_at', `${to}T23:59:59`);
  const { data: tasks, error: taskErr } = await taskQ;
  if (taskErr) return NextResponse.json({ error: taskErr.message }, { status: 500 });

  const now = new Date();
  const stats = new Map<string, { confirmed: number; missed: number; pending: number; skipped: number }>();
  for (const t of tasks ?? []) {
    const e = stats.get(t.medication_id) ?? { confirmed: 0, missed: 0, pending: 0, skipped: 0 };
    if (t.skipped) e.skipped++;
    else if (t.confirmed_at) e.confirmed++;
    else if (new Date(t.due_at) < now) e.missed++;
    else e.pending++;
    stats.set(t.medication_id, e);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (meds ?? []).map((m: any) => {
    const s = stats.get(m.id) ?? { confirmed: 0, missed: 0, pending: 0, skipped: 0 };
    const denom = s.confirmed + s.missed;
    const compliance = denom > 0 ? s.confirmed / denom : null;
    return { ...m, ...s, compliance_rate: compliance };
  });

  return NextResponse.json({ rows });
}
