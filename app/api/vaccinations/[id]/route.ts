import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { vaccinationUpdateSchema } from '@/lib/schemas/vaccinations';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const body = await request.json();
  const parsed = vaccinationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();
  const { data: existing, error: fetchErr } = await supabase
    .from('vaccinations')
    .select('id, recorded_by')
    .eq('id', params.id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAdmin = user.profile.role === 'admin';
  const isOwner = existing.recorded_by === user.authId;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('vaccinations')
    .update(parsed.data)
    .eq('id', params.id)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vaccination: data });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();
  const { data: existing, error: fetchErr } = await supabase
    .from('vaccinations')
    .select('id, recorded_by')
    .eq('id', params.id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAdmin = user.profile.role === 'admin';
  const isOwner = existing.recorded_by === user.authId;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase.from('vaccinations').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
