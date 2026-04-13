import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/current-user';
import { updateUserSchema } from '@/lib/schemas/users';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const body = await request.json();
  // `reassign_to` is extracted separately — it's a deactivation-time param,
  // not a profile field, so it lives outside updateUserSchema.
  const { reassign_to, ...rest } = body as { reassign_to?: string | null };
  const parsed = updateUserSchema.safeParse(rest);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const isDeactivating = parsed.data.is_active === false;

  // Deactivation guard: if the target has any active cats assigned, the
  // request must include `reassign_to` (null = leave as unassigned).
  if (isDeactivating) {
    const { count: assignedCount } = await admin
      .from('cats')
      .select('id', { count: 'exact', head: true })
      .eq('assignee_id', params.id)
      .eq('status', 'active');

    if ((assignedCount ?? 0) > 0 && reassign_to === undefined) {
      return NextResponse.json(
        {
          error: 'User has assigned cats. Reassign them before deactivating.',
          code: 'ASSIGNED_CATS_PRESENT',
          assigned_count: assignedCount
        },
        { status: 409 }
      );
    }

    if ((assignedCount ?? 0) > 0) {
      // Bulk-reassign (or bulk-unassign if reassign_to === null) before we
      // flip is_active — order matters so the sitter can't be picked again
      // between the reassign and the deactivation.
      const { error: reassignErr } = await admin
        .from('cats')
        .update({ assignee_id: reassign_to ?? null })
        .eq('assignee_id', params.id)
        .eq('status', 'active');
      if (reassignErr) return NextResponse.json({ error: reassignErr.message }, { status: 500 });
    }
  }

  const { error } = await admin
    .from('profiles')
    .update(parsed.data)
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If deactivating, revoke sessions.
  if (isDeactivating) {
    await admin.auth.admin.signOut(params.id).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
