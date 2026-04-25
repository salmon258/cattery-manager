import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

const SELECT_COLS =
  '*, finance_category:transaction_categories!adhoc_payments_finance_category_id_fkey(id, name, slug)';

/**
 * GET /api/finance/adhoc-payments/me
 * Sitter-facing — own ad-hoc payments, newest first.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data, error } = await supabase
    .from('adhoc_payments')
    .select(SELECT_COLS)
    .eq('profile_id', user.authId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payments: data ?? [] });
}
