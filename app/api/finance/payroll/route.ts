import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { payrollEntrySchema } from '@/lib/schemas/finance';

/**
 * GET /api/finance/payroll — admin lists every entry.
 * Query params:
 *   ?profile_id=...     narrow to one sitter
 *   ?status=pending|paid|cancelled
 *   ?from=YYYY-MM-DD    period_start >= from
 *   ?to=YYYY-MM-DD      period_end   <= to
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(request.url);
  const profileId = url.searchParams.get('profile_id');
  const status = url.searchParams.get('status');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  let q = supabase
    .from('payroll_entries')
    .select('*, profile:profiles!payroll_entries_profile_id_fkey(id, full_name, role, is_active)')
    .order('period_start', { ascending: false })
    .order('created_at', { ascending: false });

  if (profileId) q = q.eq('profile_id', profileId);
  if (status) q = q.eq('status', status);
  if (from) q = q.gte('period_start', from);
  if (to) q = q.lte('period_end', to);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}

/**
 * POST /api/finance/payroll — admin creates a payroll entry.
 * `net_amount` is derived from gross + bonus − deduction if the caller didn't
 * supply one. The DB trigger creates the matching ledger row if status=paid.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = payrollEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const net =
    parsed.data.net_amount ??
    Number(
      (
        parsed.data.gross_amount +
        parsed.data.bonus_amount -
        parsed.data.deduction_amount
      ).toFixed(2)
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data, error } = await supabase
    .from('payroll_entries')
    .insert({ ...parsed.data, net_amount: net, created_by: user.authId })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data }, { status: 201 });
}
