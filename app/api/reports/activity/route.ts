import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

type ActivityRow = {
  id: string;
  kind: 'assignee_change' | 'room_move' | 'weight_log' | 'ticket_opened' | 'vet_visit';
  at: string;
  actor: string | null;
  cat: { id: string; name: string } | null;
  summary: string;
};

/**
 * GET /api/reports/activity
 * Admin only. Aggregates recent audit events across modules into one feed.
 * Query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=200
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url   = new URL(req.url);
  const from  = url.searchParams.get('from');
  const to    = url.searchParams.get('to');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 200), 1000);

  const supabase = createClient();
  const rows: ActivityRow[] = [];

  // Helper to apply date range to any column
  function applyRange(q: unknown, col: string, endOfDay = false): unknown {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let qq: any = q;
    if (from) qq = qq.gte(col, from);
    if (to)   qq = qq.lte(col, endOfDay ? `${to}T23:59:59` : to);
    return qq;
  }

  // ─── assignee changes ─────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: assignees } = await applyRange(
    (supabase as any)
      .from('assignee_change_log')
      .select(`
        id, changed_at,
        cat:cats(id, name),
        from_assignee:profiles!assignee_change_log_from_fkey(id, full_name),
        to_assignee:profiles!assignee_change_log_to_fkey(id, full_name),
        changer:profiles!assignee_change_log_changed_by_fkey(id, full_name)
      `)
      .order('changed_at', { ascending: false })
      .limit(limit),
    'changed_at',
    true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any;

  for (const a of assignees ?? []) {
    const from_n = a.from_assignee?.full_name ?? 'Unassigned';
    const to_n   = a.to_assignee?.full_name   ?? 'Unassigned';
    rows.push({
      id: `assign-${a.id}`,
      kind: 'assignee_change',
      at: a.changed_at,
      actor: a.changer?.full_name ?? null,
      cat: a.cat,
      summary: `Reassigned ${from_n} → ${to_n}`
    });
  }

  // ─── room movements ───────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: moves } = await applyRange(
    (supabase as any)
      .from('room_movements')
      .select(`
        id, moved_at,
        cat:cats(id, name),
        from_room:rooms!from_room_id(id, name),
        to_room:rooms!to_room_id(id, name),
        mover:profiles!moved_by(id, full_name)
      `)
      .order('moved_at', { ascending: false })
      .limit(limit),
    'moved_at',
    true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any;

  for (const m of moves ?? []) {
    const from_n = m.from_room?.name ?? '—';
    const to_n   = m.to_room?.name   ?? '—';
    rows.push({
      id: `move-${m.id}`,
      kind: 'room_move',
      at: m.moved_at,
      actor: m.mover?.full_name ?? null,
      cat: m.cat,
      summary: `Moved ${from_n} → ${to_n}`
    });
  }

  // ─── weight logs ──────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: weights } = await applyRange(
    supabase
      .from('weight_logs')
      .select(`
        id, recorded_at, weight_kg,
        cat:cats(id, name),
        submitter:profiles!weight_logs_submitted_by_fkey(id, full_name)
      `)
      .order('recorded_at', { ascending: false })
      .limit(limit),
    'recorded_at',
    true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any;

  for (const w of weights ?? []) {
    rows.push({
      id: `weight-${w.id}`,
      kind: 'weight_log',
      at: w.recorded_at,
      actor: w.submitter?.full_name ?? null,
      cat: w.cat,
      summary: `Logged weight ${w.weight_kg} kg`
    });
  }

  // ─── tickets opened ───────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tickets } = await applyRange(
    (supabase as any)
      .from('health_tickets')
      .select(`
        id, created_at, title, severity,
        cat:cats(id, name),
        creator:profiles!health_tickets_created_by_fkey(id, full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit),
    'created_at',
    true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any;

  for (const tk of tickets ?? []) {
    rows.push({
      id: `ticket-${tk.id}`,
      kind: 'ticket_opened',
      at: tk.created_at,
      actor: tk.creator?.full_name ?? null,
      cat: tk.cat,
      summary: `Opened ticket: ${tk.title} (${tk.severity})`
    });
  }

  // ─── vet visits ───────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: visits } = await applyRange(
    (supabase as any)
      .from('vet_visits')
      .select(`
        id, visit_date, visit_type,
        cat:cats(id, name),
        clinic:clinics(id, name),
        creator:profiles!vet_visits_created_by_fkey(id, full_name)
      `)
      .order('visit_date', { ascending: false })
      .limit(limit),
    'visit_date'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any;

  for (const v of visits ?? []) {
    rows.push({
      id: `visit-${v.id}`,
      kind: 'vet_visit',
      at: v.visit_date,
      actor: v.creator?.full_name ?? null,
      cat: v.cat,
      summary: `Vet visit (${v.visit_type}) at ${v.clinic?.name ?? '—'}`
    });
  }

  // Sort combined feed descending by time
  rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  return NextResponse.json({ rows: rows.slice(0, limit) });
}
