import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { medicationUpdateSchema } from '@/lib/schemas/medications';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();
  const { data: medication, error } = await supabase
    .from('medications')
    .select('*')
    .eq('id', params.id)
    .single();
  if (error || !medication) return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 404 });

  const { data: tasks } = await supabase
    .from('medication_tasks')
    .select('*')
    .eq('medication_id', params.id)
    .order('due_at', { ascending: true });

  // Compliance: confirmed / (confirmed + missed-in-past). Skipped tasks are
  // excluded from the denominator because admins mark them as intentionally
  // skipped (e.g. vet on-site).
  const now = new Date();
  let confirmed = 0;
  let missed = 0;
  for (const t of tasks ?? []) {
    if (t.skipped) continue;
    if (t.confirmed_at) confirmed++;
    else if (new Date(t.due_at) < now) missed++;
  }
  const compliance_rate = confirmed + missed > 0 ? confirmed / (confirmed + missed) : null;

  return NextResponse.json({
    medication,
    tasks: tasks ?? [],
    stats: { confirmed, missed, compliance_rate }
  });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (!user.profile.is_active) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = medicationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('medications')
    .update(parsed.data)
    .eq('id', params.id)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Side-effect: when a medication plan is stopped, drop any future unconfirmed
  // tasks so they disappear from sitters' task lists immediately.
  if (parsed.data.is_active === false) {
    await supabase
      .from('medication_tasks')
      .delete()
      .eq('medication_id', params.id)
      .is('confirmed_at', null)
      .gte('due_at', new Date().toISOString());
  }

  return NextResponse.json({ medication: data });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (!user.profile.is_active) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createClient();
  const { error } = await supabase.from('medications').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
