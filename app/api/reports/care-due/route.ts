import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

/**
 * GET /api/reports/care-due?type=vaccination|flea|deworming
 *
 * Admin-only. Returns one row per active cat with the most recent administered
 * date and the next-due date for the chosen care type — used by the Care Due
 * report to plan upcoming vaccinations / flea / deworming treatments.
 *
 * "combined" preventive entries cover both flea and deworming, so they show up
 * under both views: an admin checking "what's due for flea?" should see a
 * recent combined treatment as the latest application.
 */
type CareType = 'vaccination' | 'flea' | 'deworming';

type Row = {
  cat_id: string;
  cat_name: string;
  last_administered: string | null;
  next_due_date: string | null;
};

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const type = url.searchParams.get('type') as CareType | null;
  if (type !== 'vaccination' && type !== 'flea' && type !== 'deworming') {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  const supabase = createClient();

  const { data: cats, error: catErr } = await supabase
    .from('cats')
    .select('id, name')
    .eq('status', 'active')
    .order('name', { ascending: true });
  if (catErr) return NextResponse.json({ error: catErr.message }, { status: 500 });

  // Pull every relevant care record once, then reduce to the latest entry per
  // cat in JS — simpler than DISTINCT ON / window functions and the volume
  // here is small (a few records per cat per year).
  let careRows: Array<{ cat_id: string; administered_date: string; next_due_date: string | null }> = [];

  if (type === 'vaccination') {
    const { data, error } = await supabase
      .from('vaccinations')
      .select('cat_id, administered_date, next_due_date')
      .order('administered_date', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    careRows = data ?? [];
  } else {
    // flea or deworming — both also count "combined" treatments.
    const types: Array<'flea' | 'deworming' | 'combined'> =
      type === 'flea' ? ['flea', 'combined'] : ['deworming', 'combined'];
    const { data, error } = await supabase
      .from('preventive_treatments')
      .select('cat_id, administered_date, next_due_date, treatment_type')
      .in('treatment_type', types)
      .order('administered_date', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    careRows = data ?? [];
  }

  // Latest entry per cat. Rows already arrive sorted DESC, so the first one
  // we see for a given cat is the most recent.
  const latestByCat = new Map<string, { administered_date: string; next_due_date: string | null }>();
  for (const r of careRows) {
    if (!latestByCat.has(r.cat_id)) {
      latestByCat.set(r.cat_id, { administered_date: r.administered_date, next_due_date: r.next_due_date });
    }
  }

  const rows: Row[] = (cats ?? []).map((c) => {
    const latest = latestByCat.get(c.id);
    return {
      cat_id: c.id,
      cat_name: c.name,
      last_administered: latest?.administered_date ?? null,
      next_due_date: latest?.next_due_date ?? null
    };
  });

  return NextResponse.json({ rows });
}
