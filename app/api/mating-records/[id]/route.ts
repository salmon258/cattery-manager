import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { updateMatingStatusSchema } from '@/lib/schemas/breeding';

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
 * Admin only — update status and/or notes.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body   = await req.json();
  const parsed = updateMatingStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('mating_records')
    .update(parsed.data)
    .eq('id', params.id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ record: data });
}
