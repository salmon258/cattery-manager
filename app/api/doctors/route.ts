import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { doctorSchema } from '@/lib/schemas/vet';

/**
 * GET /api/doctors
 * All authenticated users. Query params:
 *   ?clinic_id=  filter by clinic
 *   ?active=1    only active
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const clinicId   = url.searchParams.get('clinic_id');
  const onlyActive = url.searchParams.get('active') === '1';

  const supabase = createClient();
  let query = supabase
    .from('doctors')
    .select('*, clinic:clinics(id, name)')
    .order('full_name');
  if (clinicId)   query = query.eq('clinic_id', clinicId);
  if (onlyActive) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ doctors: data ?? [] });
}

/**
 * POST /api/doctors — admin only
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const parsed = doctorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();
  const { data: doctor, error } = await supabase
    .from('doctors')
    .insert(parsed.data)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ doctor }, { status: 201 });
}
