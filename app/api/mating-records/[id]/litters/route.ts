import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { litterSchema } from '@/lib/schemas/breeding';

/**
 * POST /api/mating-records/[id]/litters
 * Admin only — register a litter for a delivered mating record.
 * Body: { birth_date, litter_size_born, litter_size_survived?, notes?, kittens[] }
 *
 * Side-effects:
 *   1. Creates the litter row.
 *   2. For each kitten entry, creates a new Cat profile with:
 *      - date_of_birth = birth_date
 *      - gender from kitten input
 *      - status = 'active'
 *   3. Creates cat_lineage rows linking each kitten to its parents.
 *   4. Sets mating_record.status = 'delivered'.
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

  // 2. Create cat profiles for each named kitten
  const createdKittens: { id: string; name: string }[] = [];
  for (const kitten of kittens) {
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

    // 3. Create lineage row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('cat_lineage')
      .insert({
        kitten_id: catRow.id,
        mother_id: mating.female_cat_id,
        father_id: mating.male_cat_id,
        litter_id: litter.id
      });

    createdKittens.push(catRow);
  }

  // 4. Mark mating record as delivered
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('mating_records')
    .update({ status: 'delivered' })
    .eq('id', params.id);

  return NextResponse.json({ litter, kittens: createdKittens }, { status: 201 });
}
