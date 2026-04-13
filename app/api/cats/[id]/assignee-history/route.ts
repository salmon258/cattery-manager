import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

/**
 * GET /api/cats/[id]/assignee-history
 * All authenticated users — returns the full assignment change log for a cat.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('assignee_change_log')
    .select(`
      id, changed_at, note,
      from_assignee:profiles!assignee_change_log_from_fkey(id, full_name),
      to_assignee:profiles!assignee_change_log_to_fkey(id, full_name),
      changer:profiles!assignee_change_log_changed_by_fkey(id, full_name)
    `)
    .eq('cat_id', params.id)
    .order('changed_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}
