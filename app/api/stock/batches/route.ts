import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { stockInSchema } from '@/lib/schemas/stock';
import type { Database } from '@/lib/supabase/types';

type StockInArgs = Database['public']['Functions']['stock_in']['Args'];

// List batches (optionally filtered). Used by the checkout UI to pick a batch.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const url = new URL(request.url);
  const stockItemId = url.searchParams.get('stock_item_id');
  const locationId = url.searchParams.get('location_id');
  const availableOnly = url.searchParams.get('available_only') === '1';

  const supabase = createClient();
  let query = supabase
    .from('stock_batches')
    .select('*')
    .order('expiry_date', { ascending: true, nullsFirst: false })
    .order('received_at', { ascending: false });

  if (stockItemId) query = query.eq('stock_item_id', stockItemId);
  if (locationId) query = query.eq('location_id', locationId);
  if (availableOnly) query = query.gt('qty_remaining', 0);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ batches: data ?? [] });
}

// POST = stock-in (create new batch via RPC so the stock_in movement + finance
// trigger fire atomically). Any active user (admin or cat sitter) may record
// a stock-in so sitters can log newly arrived items without waiting on admin.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (!user.profile.is_active)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = stockInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createClient();
  // p_location_id is typed as required string but SQL accepts NULL — type-gen
  // doesn't model nullable function args, so cast the args object once.
  const rpcArgs = {
    p_stock_item_id: parsed.data.stock_item_id,
    p_qty: parsed.data.qty,
    p_location_id: parsed.data.location_id ?? null,
    p_expiry_date: parsed.data.expiry_date ?? null,
    p_cost_per_unit: parsed.data.cost_per_unit ?? null,
    p_currency: parsed.data.currency ?? null,
    p_batch_ref: parsed.data.batch_ref ?? null,
    p_notes: parsed.data.notes ?? null,
    p_received_at: parsed.data.received_at ?? null
  } as unknown as StockInArgs;
  const { data, error } = await supabase.rpc('stock_in', rpcArgs);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ batch: data }, { status: 201 });
}
