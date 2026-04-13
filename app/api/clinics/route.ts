import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { clinicSchema } from '@/lib/schemas/vet';

/**
 * GET /api/clinics
 * All authenticated users — list clinics. ?active=1 filters to active only.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const onlyActive = url.searchParams.get('active') === '1';

  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('clinics')
    .select('*, doctors(id, full_name, specialisation, is_active)')
    .order('name');
  if (onlyActive) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clinics: data ?? [] });
}

/**
 * POST /api/clinics
 * Admin only — create a clinic.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const parsed = clinicSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  // Normalise empty strings to null
  const data = {
    ...parsed.data,
    email:   parsed.data.email   || null,
    website: parsed.data.website || null
  };

  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: clinic, error } = await (supabase as any)
    .from('clinics')
    .insert(data)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clinic }, { status: 201 });
}
