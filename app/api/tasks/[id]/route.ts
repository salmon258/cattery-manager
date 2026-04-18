import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createClient();
  const { data: task, error: fetchError } = await supabase
    .from('medication_tasks')
    .select('id, due_at, confirmed_at')
    .eq('id', params.id)
    .single();
  if (fetchError || !task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (task.confirmed_at) {
    return NextResponse.json({ error: 'Cannot delete a confirmed task' }, { status: 400 });
  }
  if (new Date(task.due_at) >= new Date()) {
    return NextResponse.json({ error: 'Only overdue tasks can be deleted' }, { status: 400 });
  }

  const { error } = await supabase.from('medication_tasks').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
