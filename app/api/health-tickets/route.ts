import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

/**
 * GET /api/health-tickets
 * Admin only — list all open/in-progress tickets across all cats.
 * Query params:
 *   - severity=low|medium|high|critical  (optional filter)
 *   - count_only=1                        (returns { count } only)
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url      = new URL(req.url);
  const severity = url.searchParams.get('severity');
  const countOnly = url.searchParams.get('count_only') === '1';

  const supabase = createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('health_tickets')
    .select(
      countOnly
        ? 'id'
        : `*, cat:cats(id, name, profile_photo_url),
           creator:profiles!health_tickets_created_by_fkey(id, full_name)`,
      countOnly ? { count: 'exact', head: true } : undefined
    )
    .in('status', ['open', 'in_progress'])
    .order('created_at', { ascending: false });

  if (severity) query = query.eq('severity', severity);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (countOnly) return NextResponse.json({ count: count ?? 0 });
  return NextResponse.json({ tickets: data ?? [] });
}
