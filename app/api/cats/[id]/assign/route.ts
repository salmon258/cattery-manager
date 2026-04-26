import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { assignCatSchema } from '@/lib/schemas/assignments';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = assignCatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();

  // Validate the new assignee (if any) is an active cat_sitter.
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

  // Capture the previous assignee for the audit log
  const { data: prevCat } = await supabase
    .from('cats')
    .select('assignee_id')
    .eq('id', params.id)
    .single();
  const fromAssigneeId = prevCat?.assignee_id ?? null;

  const { data, error } = await supabase
    .from('cats')
    .update({ assignee_id: parsed.data.assignee_id })
    .eq('id', params.id)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit log — only record if something actually changed
  if (fromAssigneeId !== parsed.data.assignee_id) {
    await supabase
      .from('assignee_change_log')
      .insert({
        cat_id:           params.id,
        from_assignee_id: fromAssigneeId,
        to_assignee_id:   parsed.data.assignee_id,
        changed_by:       user.authId
      });
  }

  return NextResponse.json({ cat: data });
}
