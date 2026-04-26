import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { financialTypeSchema } from '@/lib/schemas/finance';

// Aggregated spending/income summary. Admin only (finance data).
// Shape:
//   { rows: [{period_month, type, category_id, category_name, category_slug,
//             currency, txn_count, total_amount}...] }
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const type = url.searchParams.get('type');

  const supabase = createClient();
  let query = supabase
    .from('finance_monthly_summary')
    .select('*')
    .order('period_month', { ascending: false });

  if (from) query = query.gte('period_month', from);
  if (to) query = query.lte('period_month', to);
  if (type) {
    const parsedType = financialTypeSchema.safeParse(type);
    if (parsedType.success) query = query.eq('type', parsedType.data);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}
