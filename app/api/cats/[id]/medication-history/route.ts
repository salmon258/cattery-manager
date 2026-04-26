import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

/**
 * GET /api/cats/[id]/medication-history
 *
 * Combined historical log of medicines/vitamins that were actually consumed
 * by the cat. Merges two sources:
 *  - `medication_tasks` rows that have been confirmed (scheduled doses given)
 *  - `ad_hoc_medicines` rows (one-off medicines/vitamins)
 *
 * Output is sorted by `given_at` descending and is capped at 100 entries.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 100) || 100, 500);
  const since = url.searchParams.get('since');
  const until = url.searchParams.get('until');

  const supabase = createClient();

  let tasksQuery = supabase
    .from('medication_tasks')
    .select(
      `id, due_at, confirmed_at,
         medication:medications!inner(id, medicine_name, dose, route, notes),
         confirmer:profiles!medication_tasks_confirmed_by_fkey(id, full_name)`
    )
    .eq('cat_id', params.id)
    .not('confirmed_at', 'is', null)
    .order('confirmed_at', { ascending: false })
    .limit(limit);
  if (since) tasksQuery = tasksQuery.gte('confirmed_at', since);
  if (until) tasksQuery = tasksQuery.lte('confirmed_at', until);

  let adHocQuery = supabase
    .from('ad_hoc_medicines')
    .select(
      `id, given_at, medicine_name, dose, unit, route, notes,
         submitter:profiles!ad_hoc_medicines_submitted_by_fkey(id, full_name)`
    )
    .eq('cat_id', params.id)
    .order('given_at', { ascending: false })
    .limit(limit);
  if (since) adHocQuery = adHocQuery.gte('given_at', since);
  if (until) adHocQuery = adHocQuery.lte('given_at', until);

  const [tasksRes, adHocRes] = await Promise.all([tasksQuery, adHocQuery]);

  if (tasksRes.error) return NextResponse.json({ error: tasksRes.error.message }, { status: 500 });
  if (adHocRes.error) return NextResponse.json({ error: adHocRes.error.message }, { status: 500 });

  type Entry = {
    id: string;
    source: 'scheduled' | 'ad_hoc';
    given_at: string;
    medicine_name: string;
    dose: string | null;
    unit: string | null;
    route: string;
    notes: string | null;
    by: { id: string; full_name: string } | null;
  };

  const scheduled: Entry[] = (tasksRes.data ?? []).map((t) => ({
    id: `task:${t.id}`,
    source: 'scheduled',
    given_at: t.confirmed_at as string,
    medicine_name: t.medication?.medicine_name ?? '—',
    dose: t.medication?.dose ?? null,
    unit: null,
    route: t.medication?.route ?? 'other',
    notes: t.medication?.notes ?? null,
    by: t.confirmer ?? null
  }));

  const adHoc: Entry[] = (adHocRes.data ?? []).map((a) => ({
    id: `adhoc:${a.id}`,
    source: 'ad_hoc',
    given_at: a.given_at as string,
    medicine_name: a.medicine_name,
    dose: a.dose ?? null,
    unit: a.unit ?? null,
    route: a.route,
    notes: a.notes ?? null,
    by: a.submitter ?? null
  }));

  const entries = [...scheduled, ...adHoc]
    .sort((a, b) => new Date(b.given_at).getTime() - new Date(a.given_at).getTime())
    .slice(0, limit);

  return NextResponse.json({ entries });
}
