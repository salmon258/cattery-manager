import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { assignParentsSchema } from '@/lib/schemas/breeding';

/**
 * GET /api/cats/[id]/lineage
 * All authenticated users — returns parents and offspring of a cat.
 * Response shape:
 *   { parents: { mother, father } | null,
 *     litter_siblings: CatStub[],
 *     offspring: { litter_id, birth_date, kittens: CatStub[] }[] }
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();

  // 1. Own lineage row (parents)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ownLineage } = await (supabase as any)
    .from('cat_lineage')
    .select(`
      litter_id,
      mother:cats!cat_lineage_mother_fkey(id, name, profile_photo_url, gender, breed),
      father:cats!cat_lineage_father_fkey(id, name, profile_photo_url, gender, breed)
    `)
    .eq('kitten_id', params.id)
    .maybeSingle();

  // 2. Siblings from the same litter
  let siblings: unknown[] = [];
  if (ownLineage?.litter_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: siblingRows } = await (supabase as any)
      .from('cat_lineage')
      .select('kitten:cats!cat_lineage_kitten_fkey(id, name, profile_photo_url, gender, breed)')
      .eq('litter_id', ownLineage.litter_id)
      .neq('kitten_id', params.id);
    siblings = (siblingRows ?? []).map((r: { kitten: unknown }) => r.kitten);
  }

  // 3. Offspring — litters where this cat is mother or father
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: offspringRows } = await (supabase as any)
    .from('cat_lineage')
    .select(`
      litter_id,
      kitten:cats!cat_lineage_kitten_fkey(id, name, profile_photo_url, gender, breed)
    `)
    .or(`mother_id.eq.${params.id},father_id.eq.${params.id}`);

  // Group offspring by litter
  const litterMap = new Map<string, { kittens: unknown[] }>();
  for (const row of offspringRows ?? []) {
    if (!litterMap.has(row.litter_id)) litterMap.set(row.litter_id, { kittens: [] });
    litterMap.get(row.litter_id)!.kittens.push(row.kitten);
  }
  const offspring = Array.from(litterMap.entries()).map(([litter_id, v]) => ({
    litter_id,
    ...v
  }));

  return NextResponse.json({
    parents:          ownLineage ? { mother: ownLineage.mother, father: ownLineage.father } : null,
    litter_siblings:  siblings,
    offspring
  });
}

/**
 * PUT /api/cats/[id]/lineage
 * Admin only — assign (or clear) parents for an existing cat.
 *
 * Body: { mother_id: uuid | null, father_id: uuid | null }
 *
 * This is the manual / back-fill path for lineage. The normal path is via
 * litter registration, which auto-creates lineage rows. This endpoint exists
 * for catteries that imported cats born before the app was adopted, or for
 * fixing historical data entry mistakes.
 *
 * Semantics:
 *   - mother_id must reference a female cat (or be null).
 *   - father_id must reference a male cat (or be null).
 *   - The kitten cannot be its own parent.
 *   - If a lineage row already exists, it is updated in place (the existing
 *     litter_id is preserved). Otherwise a new row is inserted with a null
 *     litter_id, since this manual assignment isn't tied to any litter.
 */
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body   = await req.json();
  const parsed = assignParentsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { mother_id, father_id } = parsed.data;
  const kittenId = params.id;

  if (mother_id && mother_id === kittenId) {
    return NextResponse.json({ error: 'A cat cannot be its own parent' }, { status: 400 });
  }
  if (father_id && father_id === kittenId) {
    return NextResponse.json({ error: 'A cat cannot be its own parent' }, { status: 400 });
  }
  if (mother_id && father_id && mother_id === father_id) {
    return NextResponse.json({ error: 'Mother and father must be different cats' }, { status: 400 });
  }

  const supabase = createClient();

  // Make sure the kitten itself exists.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: kitten, error: kittenErr } = await (supabase as any)
    .from('cats')
    .select('id')
    .eq('id', kittenId)
    .maybeSingle();
  if (kittenErr) return NextResponse.json({ error: kittenErr.message }, { status: 500 });
  if (!kitten)   return NextResponse.json({ error: 'Cat not found' }, { status: 404 });

  // Validate gender alignment for any referenced parent.
  const parentIds = [mother_id, father_id].filter((x): x is string => typeof x === 'string');
  if (parentIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: parents, error: parentErr } = await (supabase as any)
      .from('cats')
      .select('id, gender')
      .in('id', parentIds);
    if (parentErr) return NextResponse.json({ error: parentErr.message }, { status: 500 });

    const byId = new Map<string, { id: string; gender: string }>(
      (parents ?? []).map((c: { id: string; gender: string }) => [c.id, c])
    );
    if (mother_id) {
      const m = byId.get(mother_id);
      if (!m)                       return NextResponse.json({ error: 'Mother cat not found' }, { status: 404 });
      if (m.gender !== 'female')    return NextResponse.json({ error: 'Mother must be a female cat' }, { status: 400 });
    }
    if (father_id) {
      const f = byId.get(father_id);
      if (!f)                       return NextResponse.json({ error: 'Father cat not found' }, { status: 404 });
      if (f.gender !== 'male')      return NextResponse.json({ error: 'Father must be a male cat' }, { status: 400 });
    }
  }

  // Fetch existing lineage row so we can decide between update and insert.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: existingErr } = await (supabase as any)
    .from('cat_lineage')
    .select('id, litter_id')
    .eq('kitten_id', kittenId)
    .maybeSingle();
  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 });

  if (existing) {
    // Both sides cleared AND row has no litter linkage → drop the row entirely
    // so the cat reads as "no lineage" again instead of an empty placeholder.
    if (mother_id === null && father_id === null && !existing.litter_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: delErr } = await (supabase as any)
        .from('cat_lineage')
        .delete()
        .eq('id', existing.id);
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
      return NextResponse.json({ lineage: null });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error: updErr } = await (supabase as any)
      .from('cat_lineage')
      .update({ mother_id, father_id })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    return NextResponse.json({ lineage: updated });
  }

  // No existing row — only insert when something is actually being set.
  if (mother_id === null && father_id === null) {
    return NextResponse.json({ lineage: null });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error: insErr } = await (supabase as any)
    .from('cat_lineage')
    .insert({ kitten_id: kittenId, mother_id, father_id, litter_id: null })
    .select('*')
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json({ lineage: inserted });
}
