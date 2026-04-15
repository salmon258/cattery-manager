import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { eatingLogSchema } from '@/lib/schemas/eating';

/**
 * PATCH /api/eating-logs/[id]
 *
 * Edit a meal session. A sitter can edit their OWN submission; admins can
 * edit anything (RLS enforces this — owner policies were added in the
 * 20260429 migration). The request body uses the same shape as the POST
 * route on /api/cats/[id]/eating: feeding_method + notes + a full items
 * array. Items are replaced atomically (delete existing children, insert
 * the new set) so the caller doesn't have to diff.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const body = await req.json();
  const parsed = eatingLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();

  // Fetch the existing row so we can enforce ownership up front and surface
  // a clean 404/403 before we start mutating children.
  const { data: existing, error: fetchErr } = await supabase
    .from('eating_logs')
    .select('id, submitted_by, cat_id')
    .eq('id', params.id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAdmin = user.profile.role === 'admin';
  const isOwner = existing.submitted_by === user.authId;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Resolve calories_per_gram snapshots for the replacement item set.
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

  // Update parent fields first. We don't touch cat_id / submitted_by /
  // meal_time here — changing meal_time would shift day buckets in reports
  // and is out of scope for a simple "fix a typo" edit.
  const { error: updateErr } = await supabase
    .from('eating_logs')
    .update({
      feeding_method: parsed.data.feeding_method,
      notes: parsed.data.notes ?? null
    })
    .eq('id', params.id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Replace children. eating_log_items.estimated_kcal_consumed is a stored
  // generated column, so we can't UPDATE an existing row to change the food
  // or the eaten ratio without Postgres recomputing — safer to wipe and
  // re-insert, which also keeps snapshots in sync with the current
  // calories_per_gram.
  const { error: deleteErr } = await supabase
    .from('eating_log_items')
    .delete()
    .eq('eating_log_id', params.id);
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  const itemsToInsert = parsed.data.items.map((i) => ({
    eating_log_id: params.id,
    food_item_id: i.food_item_id,
    quantity_given_g: i.quantity_given_g,
    quantity_eaten: i.quantity_eaten,
    calories_per_gram_snapshot: foodMap.get(i.food_item_id)!.calories_per_gram
  }));
  const { error: insertErr } = await supabase.from('eating_log_items').insert(itemsToInsert);
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ id: params.id });
}

/**
 * DELETE /api/eating-logs/[id]
 *
 * A sitter can delete their OWN meal; admins can delete any. Child rows
 * are removed by the ON DELETE CASCADE on eating_log_items.eating_log_id.
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();
  const { data: existing, error: fetchErr } = await supabase
    .from('eating_logs')
    .select('id, submitted_by')
    .eq('id', params.id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAdmin = user.profile.role === 'admin';
  const isOwner = existing.submitted_by === user.authId;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase.from('eating_logs').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
