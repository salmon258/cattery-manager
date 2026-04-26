import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { batchAssignCatsSchema } from '@/lib/schemas/assignments';

/**
 * POST /api/cats/assign-batch
 * Admin only — assign multiple cats to a single cat_sitter (or unassign all).
 * Body: { cat_ids: string[], assignee_id: string | null }
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body   = await request.json();
  const parsed = batchAssignCatsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();

  // Validate assignee (if any) is an active cat_sitter
  if (parsed.data.assignee_id) {
    const { data: assignee, error: assigneeErr } = await supabase
      .from('profiles')
      .select('id, role, is_active')
      .eq('id', parsed.data.assignee_id)
      .single();
    if (assigneeErr || !assignee) {
      return NextResponse.json({ error: 'Assignee not found' }, { status: 400 });
    }
    if (assignee.role !== 'cat_sitter' || !assignee.is_active) {
      return NextResponse.json(
        { error: 'Assignee must be an active Cat Sitter' },
        { status: 400 }
      );
    }
  }

  // Capture previous assignees BEFORE update so the audit log records the transition
  const { data: prevCats } = await supabase
    .from('cats')
    .select('id, assignee_id')
    .in('id', parsed.data.cat_ids);

  const { error, count } = await supabase
    .from('cats')
    .update({ assignee_id: parsed.data.assignee_id }, { count: 'exact' })
    .in('id', parsed.data.cat_ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Write one audit row per cat that actually changed
  const changedRows = (prevCats ?? [])
    .filter((c) => c.assignee_id !== parsed.data.assignee_id)
    .map((c) => ({
      cat_id:           c.id,
      from_assignee_id: c.assignee_id,
      to_assignee_id:   parsed.data.assignee_id,
      changed_by:       user.authId,
      note:             'batch'
    }));

  if (changedRows.length > 0) {
    await supabase.from('assignee_change_log').insert(changedRows);
  }

  return NextResponse.json({ updated: count ?? 0 });
}
