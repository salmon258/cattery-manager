import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const stockItemId = url.searchParams.get('stock_item_id');
  const batchId = url.searchParams.get('batch_id');
  const locationId = url.searchParams.get('location_id');
  const catId = url.searchParams.get('for_cat_id');
  const movedBy = url.searchParams.get('moved_by');
  const since = url.searchParams.get('since'); // ISO date
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '100') || 100, 500);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  let query = supabase
    .from('stock_movements')
    .select(
      `*,
       batch:stock_batches!inner(id, stock_item_id, location_id, expiry_date, cost_per_unit, currency, batch_ref,
         item:stock_items(id, name, brand, category, unit)
       ),
       for_cat:cats(id, name),
       moved_by_profile:profiles(id, full_name)`
    )
    .order('moved_at', { ascending: false })
    .limit(limit);

  if (type) query = query.eq('type', type);
  if (batchId) query = query.eq('batch_id', batchId);
  if (catId) query = query.eq('for_cat_id', catId);
  if (movedBy) query = query.eq('moved_by', movedBy);
  if (locationId) {
    // Either leg of the move touches this location
    query = query.or(`from_location_id.eq.${locationId},to_location_id.eq.${locationId}`);
  }
  if (stockItemId) query = query.eq('batch.stock_item_id', stockItemId);
  if (since) query = query.gte('moved_at', since);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ movements: data ?? [] });
}
