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
 * array. The actual UPDATE + child replacement happens inside the
 * `update_eating_log` Postgres function so it's one transaction — see
 * 20260518 migration for the rationale.
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

  // Run the parent UPDATE + items DELETE + items INSERT inside one Postgres
  // function so the whole edit is a single transaction. Two rapid-fire saves
  // (mobile double-tap, retry after a slow network) used to interleave on
  // the server and leave the meal with two copies of every item; serializing
  // on the parent row's update lock fixes that.
  const { error: rpcErr } = await supabase.rpc('update_eating_log', {
    p_log_id: params.id,
    p_feeding_method: parsed.data.feeding_method,
    p_notes: parsed.data.notes ?? null,
    p_items: parsed.data.items
  });
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });

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
