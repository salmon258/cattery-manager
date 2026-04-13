import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

/**
 * GET /api/reports/health-tickets
 * Admin only. All tickets with time-to-resolve and severity breakdown.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url  = new URL(req.url);
  const from = url.searchParams.get('from');
  const to   = url.searchParams.get('to');

  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .from('health_tickets')
    .select(`
      id, cat_id, title, severity, status, created_at, resolved_at, resolution_summary,
      cat:cats(id, name),
      creator:profiles!health_tickets_created_by_fkey(id, full_name)
    `)
    .order('created_at', { ascending: false });

  if (from) q = q.gte('created_at', from);
  if (to)   q = q.lte('created_at', `${to}T23:59:59`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []).map((t: any) => {
    let time_to_resolve_hours: number | null = null;
    if (t.resolved_at && t.created_at) {
      const ms = new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime();
      time_to_resolve_hours = Math.round(ms / 3600000);
    }
    return { ...t, time_to_resolve_hours };
  });

  // Severity breakdown
  const severityCounts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of rows as any[]) severityCounts[t.severity] = (severityCounts[t.severity] ?? 0) + 1;

  return NextResponse.json({ rows, severityCounts });
}
