import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('cats')
    .select('*, current_room:rooms(id, name), assignee:profiles!cats_assignee_id_fkey(id, full_name)')
    .eq('assignee_id', user.profile.id)
    .eq('status', 'active')
    .order('name', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const cats = data ?? [];

  // Fetch the latest weight recorded_at for each assigned cat so the client
  // can show a "log today's weight" reminder when no weight has been logged today.
  const catIds = cats.map((c) => c.id);
  const { data: latestWeights } = catIds.length
    ? await supabase.from('cat_latest_weight').select('cat_id, recorded_at').in('cat_id', catIds)
    : { data: [] };

  const weightByCat = new Map((latestWeights ?? []).map((w) => [w.cat_id, w.recorded_at]));

  // Count open/in-progress health tickets per assigned cat
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: openTickets } = catIds.length
    ? await (supabase as any)
        .from('health_tickets')
        .select('cat_id')
        .in('cat_id', catIds)
        .in('status', ['open', 'in_progress'])
    : { data: [] };

  const ticketCountByCat = new Map<string, number>();
  for (const tk of openTickets ?? []) {
    ticketCountByCat.set(tk.cat_id, (ticketCountByCat.get(tk.cat_id) ?? 0) + 1);
  }

  const result = cats.map((c) => ({
    ...c,
    last_weight_recorded_at: weightByCat.get(c.id) ?? null,
    open_ticket_count: ticketCountByCat.get(c.id) ?? 0
  }));

  return NextResponse.json({ cats: result });
}
