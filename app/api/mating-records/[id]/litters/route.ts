import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { litterSchema } from '@/lib/schemas/breeding';

/**
 * POST /api/mating-records/[id]/litters
 * Admin only — register a litter for a mating record.
 * Body: { birth_date, litter_size_born, litter_size_survived?, notes?, kittens[] }
 *
 * Each kitten entry is either:
 *   { kind: 'new',      name, gender } — creates a fresh cats row
 *   { kind: 'existing', cat_id }       — attaches an already-imported cat
 *
 * Side-effects:
 *   1. Creates the litter row.
 *   2. For each kitten entry:
 *        - 'new':      creates a cats row (dob = birth_date, status = 'active')
 *                      and a cat_lineage row linking to the parents.
 *        - 'existing': verifies the cat exists and is not either parent, then
 *                      upserts its cat_lineage row to point at this litter and
 *                      these parents. If the cat already has a lineage row it
 *                      is overwritten.
 *   3. Sets mating_record.status = 'delivered'.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body   = await req.json();
  const parsed = litterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();

  // Fetch the mating record to get parent cat IDs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: mating, error: matingErr } = await (supabase as any)
    .from('mating_records')
    .select('id, female_cat_id, male_cat_id, status')
    .eq('id', params.id)
    .single();

  if (matingErr || !mating) {
    return NextResponse.json({ error: 'Mating record not found' }, { status: 404 });
  }

  const { birth_date, litter_size_born, litter_size_survived, notes, kittens } = parsed.data;

  // Pre-flight: make sure none of the "existing" kittens are either parent,
  // and that every referenced cat actually exists.
  const existingIds = kittens
    .filter((k): k is Extract<typeof k, { kind: 'existing' }> => k.kind === 'existing')
    .map((k) => k.cat_id);
  if (existingIds.length > 0) {
    if (new Set(existingIds).size !== existingIds.length) {
      return NextResponse.json({ error: 'Same cat selected twice as a kitten' }, { status: 400 });
    }
    if (existingIds.includes(mating.female_cat_id) || existingIds.includes(mating.male_cat_id)) {
      return NextResponse.json({ error: 'A parent cannot be its own kitten' }, { status: 400 });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: found, error: foundErr } = await (supabase as any)
      .from('cats')
      .select('id')
      .in('id', existingIds);
    if (foundErr) return NextResponse.json({ error: foundErr.message }, { status: 500 });
    const foundIds = new Set((found ?? []).map((c: { id: string }) => c.id));
    const missing  = existingIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      return NextResponse.json({ error: `Cat not found: ${missing.join(', ')}` }, { status: 404 });
    }
  }

  // 1. Create litter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: litter, error: litterErr } = await (supabase as any)
    .from('litters')
    .insert({
      mating_record_id: params.id,
      birth_date,
      litter_size_born,
      litter_size_survived: litter_size_survived ?? null,
      notes: notes ?? null,
      created_by: user.authId
    })
    .select('*')
    .single();

  if (litterErr) return NextResponse.json({ error: litterErr.message }, { status: 500 });

  // 2. For each kitten, create a cat profile (new) or attach lineage (existing)
  const resolvedKittens: { id: string; name: string; existing: boolean }[] = [];
  for (const kitten of kittens) {
    if (kitten.kind === 'new') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: catRow, error: catErr } = await (supabase as any)
        .from('cats')
        .insert({
          name:           kitten.name,
          gender:         kitten.gender,
          date_of_birth:  birth_date,
          status:         'active',
          created_by:     user.authId
        })
        .select('id, name')
        .single();

      if (catErr) return NextResponse.json({ error: `Failed to create kitten: ${catErr.message}` }, { status: 500 });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: lineageErr } = await (supabase as any)
        .from('cat_lineage')
        .insert({
          kitten_id: catRow.id,
          mother_id: mating.female_cat_id,
          father_id: mating.male_cat_id,
          litter_id: litter.id
        });
      if (lineageErr) return NextResponse.json({ error: lineageErr.message }, { status: 500 });

      resolvedKittens.push({ id: catRow.id, name: catRow.name, existing: false });
    } else {
      // Existing cat: upsert the lineage row. cat_lineage has a UNIQUE
      // constraint on kitten_id, so we check for an existing row first and
      // update in place rather than inserting blindly.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingLineage, error: lookupErr } = await (supabase as any)
        .from('cat_lineage')
        .select('id')
        .eq('kitten_id', kitten.cat_id)
        .maybeSingle();
      if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 500 });

      if (existingLineage) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updErr } = await (supabase as any)
          .from('cat_lineage')
          .update({
            mother_id: mating.female_cat_id,
            father_id: mating.male_cat_id,
            litter_id: litter.id
          })
          .eq('id', existingLineage.id);
        if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insErr } = await (supabase as any)
          .from('cat_lineage')
          .insert({
            kitten_id: kitten.cat_id,
            mother_id: mating.female_cat_id,
            father_id: mating.male_cat_id,
            litter_id: litter.id
          });
        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: catRow } = await (supabase as any)
        .from('cats')
        .select('id, name')
        .eq('id', kitten.cat_id)
        .single();
      resolvedKittens.push({ id: kitten.cat_id, name: catRow?.name ?? '', existing: true });
    }
  }

  // 3. Mark mating record as delivered
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('mating_records')
    .update({ status: 'delivered' })
    .eq('id', params.id);

  return NextResponse.json({ litter, kittens: resolvedKittens }, { status: 201 });
}
