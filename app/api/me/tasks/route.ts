import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

/**
 * GET /api/me/tasks
 * Today's + overdue medication tasks for the current sitter's assigned cats.
 * Admins get every cat's tasks (they don't have "assigned" cats per se).
 * Query params:
 *   - scope=assigned|all (sitter default: assigned; admin default: all)
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const url = new URL(request.url);
  const scope = url.searchParams.get('scope') ?? (user.profile.role === 'admin' ? 'all' : 'assigned');

  const supabase = createClient();

  // End-of-today (local-time proxy): now + 24h window. Spec focuses on "today"
  // but an explicit end-of-day would miss doses due at 23:45 when the user
  // checks at 00:05 the next morning. Using a rolling window is forgiving.
  const endOfWindow = new Date();
  endOfWindow.setHours(23, 59, 59, 999);

  let query = supabase
    .from('medication_tasks')
    .select(
      `*,
       medication:medications(id, medicine_name, dose, route),
       cat:cats(id, name, profile_photo_url, assignee_id)`
    )
    .is('confirmed_at', null)
    .eq('skipped', false)
    .lte('due_at', endOfWindow.toISOString())
    .order('due_at', { ascending: true });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let tasks = data ?? [];
  if (scope === 'assigned' && user.profile.role !== 'admin') {
    tasks = tasks.filter((t: { cat: { assignee_id: string | null } | null }) =>
      t.cat?.assignee_id === user.profile.id
    );
  }

  return NextResponse.json({ tasks });
}
