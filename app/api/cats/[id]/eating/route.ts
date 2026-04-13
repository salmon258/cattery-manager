import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { eatingLogSchema } from '@/lib/schemas/eating';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 500);

  const supabase = createClient();
  const { data, error } = await supabase
    .from('eating_logs')
    .select(
      `*,
       submitter:profiles!eating_logs_submitted_by_fkey(id, full_name),
       items:eating_log_items(
         id, food_item_id, quantity_given_g, quantity_eaten,
         calories_per_gram_snapshot, estimated_kcal_consumed,
         food:food_items(id, name, brand, type, unit)
       )`
    )
    .eq('cat_id', params.id)
    .order('meal_time', { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data ?? [] });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const body = await request.json();
  const parsed = eatingLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();

  // Fetch calories_per_gram snapshots for every referenced food item in one round-trip.
  const foodIds = Array.from(new Set(parsed.data.items.map((i) => i.food_item_id)));
  const { data: foods, error: foodsErr } = await supabase
    .from('food_items')
    .select('id, calories_per_gram, is_active')
    .in('id', foodIds);
  if (foodsErr) return NextResponse.json({ error: foodsErr.message }, { status: 500 });

  const foodMap = new Map((foods ?? []).map((f) => [f.id, f]));
  for (const item of parsed.data.items) {
    const f = foodMap.get(item.food_item_id);
    if (!f) return NextResponse.json({ error: `Unknown food item: ${item.food_item_id}` }, { status: 400 });
    if (!f.is_active) {
      return NextResponse.json({ error: 'Cannot log an inactive food item' }, { status: 400 });
    }
  }

  // Insert meal session first, then items referencing it.
  const { data: session, error: insertErr } = await supabase
    .from('eating_logs')
    .insert({
      cat_id: params.id,
      meal_time: parsed.data.meal_time,
      feeding_method: parsed.data.feeding_method,
      notes: parsed.data.notes ?? null,
      submitted_by: user.authId
    })
    .select('id')
    .single();
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  const itemsToInsert = parsed.data.items.map((i) => ({
    eating_log_id: session.id,
    food_item_id: i.food_item_id,
    quantity_given_g: i.quantity_given_g,
    quantity_eaten: i.quantity_eaten,
    calories_per_gram_snapshot: foodMap.get(i.food_item_id)!.calories_per_gram
  }));

  const { error: itemsErr } = await supabase.from('eating_log_items').insert(itemsToInsert);
  if (itemsErr) {
    // Best-effort cleanup: remove the orphaned meal session.
    await supabase.from('eating_logs').delete().eq('id', session.id);
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: session.id }, { status: 201 });
}
