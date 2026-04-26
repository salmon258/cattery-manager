import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

/**
 * GET /api/finance/payroll/me
 * Sitter-facing endpoint — returns only own payroll rows (RLS-enforced) plus
 * the current active salary row for display on the profile/my-payroll page.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();

  const { data: entries, error: entriesErr } = await supabase
    .from('payroll_entries')
    .select('*')
    .eq('profile_id', user.authId)
    .order('period_start', { ascending: false })
    .order('created_at', { ascending: false });
  if (entriesErr) return NextResponse.json({ error: entriesErr.message }, { status: 500 });

  const { data: salaries } = await supabase
    .from('profile_salaries')
    .select('*')
    .eq('profile_id', user.authId)
    .lte('effective_from', new Date().toISOString().slice(0, 10))
    .order('effective_from', { ascending: false })
    .limit(1);

  return NextResponse.json({
    entries: entries ?? [],
    current_salary: salaries?.[0] ?? null
  });
}
