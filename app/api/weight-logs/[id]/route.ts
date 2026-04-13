import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { weightLogSchema } from '@/lib/schemas/weight';

/**
 * PATCH /api/weight-logs/[id]
 * A user can edit their OWN weight log; admins can edit any.
 * (RLS policies enforce this — owner policy added in 20260423 migration.)
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const body   = await req.json();
  const parsed = weightLogSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();
  // Fetch existing row to enforce ownership (RLS also enforces this; defense in depth)
  const { data: existing, error: fetchErr } = await supabase
    .from('weight_logs')
    .select('id, submitted_by')
    .eq('id', params.id)
    .single();
  if (fetchErr || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAdmin = user.profile.role === 'admin';
  const isOwner = existing.submitted_by === user.authId;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('weight_logs')
    .update(parsed.data)
    .eq('id', params.id)
    .select('*, submitter:profiles!weight_logs_submitted_by_fkey(id, full_name)')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data });
}

/**
 * DELETE /api/weight-logs/[id]
 * A user can delete their OWN weight log; admins can delete any.
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();
  const { data: existing, error: fetchErr } = await supabase
    .from('weight_logs')
    .select('id, submitted_by')
    .eq('id', params.id)
    .single();
  if (fetchErr || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAdmin = user.profile.role === 'admin';
  const isOwner = existing.submitted_by === user.authId;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase.from('weight_logs').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
