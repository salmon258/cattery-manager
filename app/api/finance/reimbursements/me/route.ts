import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

const SELECT_COLS =
  '*, category:reimbursement_categories!reimbursement_requests_category_id_fkey(id, name, slug, icon)';

/**
 * GET /api/finance/reimbursements/me
 * Sitter-facing endpoint — returns own reimbursement requests across all
 * statuses, newest first.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('reimbursement_requests')
    .select(SELECT_COLS)
    .eq('profile_id', user.authId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data ?? [] });
}
