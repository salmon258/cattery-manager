import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { z } from 'zod';

const genSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  // Optional list of profile ids; defaults to every active user with a salary.
  profile_ids: z.array(z.string().uuid()).optional()
});

/**
 * POST /api/finance/payroll/generate  (admin only)
 * Creates `pending` payroll entries for the given month from each sitter's
 * currently-active salary. Skips anyone who already has an entry for the
 * same period (the unique constraint on (profile_id, period_start,
 * period_end) acts as a safety net).
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = genSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { year, month, profile_ids } = parsed.data;

  const periodStart = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
  const periodEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  // Pull the latest effective salary for each candidate profile.
  let profQ = supabase
    .from('profiles')
    .select('id, full_name, is_active, role')
    .eq('is_active', true);
  if (profile_ids && profile_ids.length > 0) profQ = profQ.in('id', profile_ids);
  const { data: profiles, error: profErr } = await profQ;
  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

  const { data: salariesAll } = await supabase
    .from('profile_salaries')
    .select('*')
    .lte('effective_from', periodEnd)
    .order('effective_from', { ascending: false });
  // Latest-wins per profile.
  const latest = new Map<string, typeof salariesAll[number]>();
  for (const s of (salariesAll ?? []) as Array<{
    profile_id: string;
    effective_from: string;
    monthly_salary: number;
    currency: string;
  }>) {
    if (!latest.has(s.profile_id)) latest.set(s.profile_id, s);
  }

  const { data: existing } = await supabase
    .from('payroll_entries')
    .select('profile_id')
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd);
  const alreadyHas = new Set(
    ((existing ?? []) as Array<{ profile_id: string }>).map((e) => e.profile_id)
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = [];
  const skipped: Array<{ profile_id: string; reason: string }> = [];
  for (const p of (profiles ?? []) as Array<{ id: string }>) {
    if (alreadyHas.has(p.id)) {
      skipped.push({ profile_id: p.id, reason: 'exists' });
      continue;
    }
    const sal = latest.get(p.id);
    if (!sal) {
      skipped.push({ profile_id: p.id, reason: 'no_salary' });
      continue;
    }
    rows.push({
      profile_id: p.id,
      period_start: periodStart,
      period_end: periodEnd,
      gross_amount: sal.monthly_salary,
      bonus_amount: 0,
      deduction_amount: 0,
      net_amount: sal.monthly_salary,
      currency: sal.currency,
      status: 'pending',
      created_by: user.authId
    });
  }

  if (rows.length === 0) {
    return NextResponse.json({ created: 0, skipped, entries: [] });
  }

  const { data: created, error: insErr } = await supabase
    .from('payroll_entries')
    .insert(rows)
    .select('*');
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json(
    { created: created?.length ?? 0, skipped, entries: created ?? [] },
    { status: 201 }
  );
}
