import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { matingRecordSchema, matingStatusSchema } from '@/lib/schemas/breeding';

/**
 * GET /api/mating-records
 * All authenticated users can list mating records.
 * Query params: ?cat_id=  (filter by female or male cat)
 *               ?status=  (filter by status)
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const url    = new URL(req.url);
  const catId  = url.searchParams.get('cat_id');
  const status = url.searchParams.get('status');

  const supabase = createClient();

  let query = supabase
    .from('mating_records')
    .select(`
      *,
      female_cat:cats!mating_records_female_cat_fkey(id, name, profile_photo_url, gender),
      male_cat:cats!mating_records_male_cat_fkey(id, name, profile_photo_url, gender),
      creator:profiles!mating_records_created_by_fkey(id, full_name),
      litters(id, birth_date, litter_size_born, litter_size_survived)
    `)
    .order('mating_date', { ascending: false });

  if (catId) {
    query = query.or(`female_cat_id.eq.${catId},male_cat_id.eq.${catId}`);
  }
  if (status) {
    const parsedStatus = matingStatusSchema.safeParse(status);
    if (parsedStatus.success) query = query.eq('status', parsedStatus.data);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: data ?? [] });
}

/**
 * POST /api/mating-records
 * Admin only — create a new mating record.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body   = await req.json();
  const parsed = matingRecordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.female_cat_id === parsed.data.male_cat_id) {
    return NextResponse.json({ error: 'Female and male cat must be different' }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('mating_records')
    .insert({ ...parsed.data, created_by: user.authId })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ record: data }, { status: 201 });
}
