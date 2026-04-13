import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/current-user';
import { createUserSchema } from '@/lib/schemas/users';

export async function GET() {
  try {
    await requireAdmin();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Join emails from auth.users
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = new Map(authData?.users.map((u) => [u.id, u.email]) ?? []);

  // Assigned (active) cat counts per cat_sitter — aggregate client-side from
  // active cats. The assignee_cat_counts view exists (Phase 3 migration) but
  // isn't in the generated TS types; a one-shot group in JS keeps the code
  // regen-proof.
  const { data: assignedRows } = await admin
    .from('cats')
    .select('assignee_id')
    .eq('status', 'active')
    .not('assignee_id', 'is', null);
  const countMap = new Map<string, number>();
  for (const row of assignedRows ?? []) {
    if (!row.assignee_id) continue;
    countMap.set(row.assignee_id, (countMap.get(row.assignee_id) ?? 0) + 1);
  }

  const rows = (profiles ?? []).map((p) => ({
    ...p,
    email: emailMap.get(p.id) ?? null,
    assigned_cats_count: p.role === 'cat_sitter' ? countMap.get(p.id) ?? 0 : 0
  }));
  return NextResponse.json({ users: rows });
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { email, password, full_name, role } = parsed.data;
  const admin = createServiceRoleClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role }
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // The trigger on auth.users auto-inserts a profile, but we update to ensure
  // full_name + role are exactly what Admin chose (trigger may have defaulted).
  await admin
    .from('profiles')
    .update({ full_name, role })
    .eq('id', data.user.id);

  return NextResponse.json({ id: data.user.id }, { status: 201 });
}
