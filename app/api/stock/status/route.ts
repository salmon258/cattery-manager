import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { stockCategorySchema } from '@/lib/schemas/stock';

// Aggregate view: one row per stock item with qty_on_hand, is_low_stock, earliest_expiry.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const lowOnly = url.searchParams.get('low_only') === '1';
  const includeInactive = url.searchParams.get('include_inactive') === '1';

  const supabase = createClient();
  let query = supabase.from('stock_item_status').select('*').order('name', { ascending: true });
  if (!includeInactive) query = query.eq('is_active', true);
  if (category) {
    const parsedCategory = stockCategorySchema.safeParse(category);
    if (parsedCategory.success) query = query.eq('category', parsedCategory.data);
  }
  if (lowOnly) query = query.eq('is_low_stock', true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: data ?? [] });
}
