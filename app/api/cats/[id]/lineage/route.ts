import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

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
