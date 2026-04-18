import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

// Aggregate view: one row per stock item with qty_on_hand, is_low_stock, earliest_expiry.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const lowOnly = url.searchParams.get('low_only') === '1';
  const includeInactive = url.searchParams.get('include_inactive') === '1';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  let query = supabase.from('stock_item_status').select('*').order('name', { ascending: true });
  if (!includeInactive) query = query.eq('is_active', true);
  if (category) query = query.eq('category', category);
  if (lowOnly) query = query.eq('is_low_stock', true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: data ?? [] });
}
