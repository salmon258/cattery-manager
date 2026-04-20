import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { profileSalarySchema } from '@/lib/schemas/finance';

/**
 * GET /api/finance/salaries
 * Admin lists every salary row joined to the profile.
 * Optional ?profile_id=... narrows to a single sitter's history.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(request.url);
  const profileId = url.searchParams.get('profile_id');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  let q = supabase
    .from('profile_salaries')
    .select('*, profile:profiles!profile_salaries_profile_id_fkey(id, full_name, role, is_active)')
    .order('effective_from', { ascending: false })
    .order('created_at', { ascending: false });
  if (profileId) q = q.eq('profile_id', profileId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ salaries: data ?? [] });
}

/**
 * POST /api/finance/salaries  (admin only)
 * Creates a new salary row. History is preserved — later rows with a more
 * recent effective_from automatically supersede earlier ones.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = profileSalarySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data, error } = await supabase
    .from('profile_salaries')
    .insert({ ...parsed.data, created_by: user.authId })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ salary: data }, { status: 201 });
}
