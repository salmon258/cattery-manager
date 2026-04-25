import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { adhocPaymentSchema } from '@/lib/schemas/finance';

const SELECT_COLS =
  '*, profile:profiles!adhoc_payments_profile_id_fkey(id, full_name, role, is_active),' +
  ' finance_category:transaction_categories!adhoc_payments_finance_category_id_fkey(id, name, slug)';

/**
 * GET /api/finance/adhoc-payments — admin-only list. Sitters use /me.
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
    .from('adhoc_payments')
    .select(SELECT_COLS)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (profileId) q = q.eq('profile_id', profileId);
  if (status) q = q.eq('status', status);
  if (from) q = q.gte('payment_date', from);
  if (to) q = q.lte('payment_date', to);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payments: data ?? [] });
}

/**
 * POST /api/finance/adhoc-payments — admin creates a one-off payment for a
 * sitter. If status='paid', the trigger drops a financial_transactions row.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = adhocPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data, error } = await supabase
    .from('adhoc_payments')
    .insert({ ...parsed.data, created_by: user.authId })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payment: data }, { status: 201 });
}
