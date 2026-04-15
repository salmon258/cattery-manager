import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { editMatingRecordSchema } from '@/lib/schemas/breeding';

/**
 * GET /api/mating-records/[id]
 * All authenticated users — full record with embedded cats and litters.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('mating_records')
    .select(`
      *,
      female_cat:cats!mating_records_female_cat_fkey(id, name, profile_photo_url, gender, breed),
      male_cat:cats!mating_records_male_cat_fkey(id, name, profile_photo_url, gender, breed),
      creator:profiles!mating_records_created_by_fkey(id, full_name),
      litters(
        id, birth_date, litter_size_born, litter_size_survived, notes, created_at,
        creator:profiles!litters_created_by_fkey(id, full_name)
      )
    `)
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ record: data });
}

/**
 * PATCH /api/mating-records/[id]
 * Admin only — partial update.
 *
 * Accepts any subset of { female_cat_id, male_cat_id, mating_date,
 * mating_method, status, notes }. Used both by the "Update status" quick
 * action and the full "Edit mating" form.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body   = await req.json();
  const parsed = editMatingRecordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();

  // If the client is changing either cat, we need to make sure the female
  // really is female, the male really is male, and the two aren't the same.
  // Fetch the current row first so we can reason about merged values.
  const patch = parsed.data;
  if (patch.female_cat_id || patch.male_cat_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: current, error: currentErr } = await (supabase as any)
      .from('mating_records')
      .select('female_cat_id, male_cat_id')
      .eq('id', params.id)
      .single();
    if (currentErr || !current) {
      return NextResponse.json({ error: 'Mating record not found' }, { status: 404 });
    }

    const nextFemale = patch.female_cat_id ?? current.female_cat_id;
    const nextMale   = patch.male_cat_id   ?? current.male_cat_id;
    if (nextFemale === nextMale) {
      return NextResponse.json({ error: 'Female and male cat must be different' }, { status: 400 });
    }

    // Validate gender alignment for whichever side actually changed.
    const idsToCheck: string[] = [];
    if (patch.female_cat_id) idsToCheck.push(patch.female_cat_id);
    if (patch.male_cat_id)   idsToCheck.push(patch.male_cat_id);
    if (idsToCheck.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: catRows, error: catErr } = await (supabase as any)
        .from('cats')
        .select('id, gender')
        .in('id', idsToCheck);
      if (catErr) return NextResponse.json({ error: catErr.message }, { status: 500 });
      const byId = new Map<string, { id: string; gender: string }>(
        (catRows ?? []).map((c: { id: string; gender: string }) => [c.id, c])
      );
      if (patch.female_cat_id && byId.get(patch.female_cat_id)?.gender !== 'female') {
        return NextResponse.json({ error: 'Selected female cat is not female' }, { status: 400 });
      }
      if (patch.male_cat_id && byId.get(patch.male_cat_id)?.gender !== 'male') {
        return NextResponse.json({ error: 'Selected male cat is not male' }, { status: 400 });
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('mating_records')
    .update(patch)
    .eq('id', params.id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ record: data });
}
