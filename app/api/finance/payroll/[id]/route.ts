import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { payrollEntryUpdateSchema } from '@/lib/schemas/finance';
import type { Database } from '@/lib/supabase/types';

type PayrollEntryUpdate = Database['public']['Tables']['payroll_entries']['Update'];

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('payroll_entries')
    .select('*, profile:profiles!payroll_entries_profile_id_fkey(id, full_name, role, is_active)')
    .eq('id', params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // RLS blocks non-admin non-owner, so reaching here means access is allowed.
  return NextResponse.json({ entry: data });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = payrollEntryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // If any of (gross, bonus, deduction) changed and net_amount wasn't
  // explicitly supplied, recompute from the fresh row.
  const supabase = createClient();
  const patch: PayrollEntryUpdate = { ...parsed.data };
  if (
    patch.net_amount === undefined &&
    (patch.gross_amount !== undefined ||
      patch.bonus_amount !== undefined ||
      patch.deduction_amount !== undefined)
  ) {
    const { data: current } = await supabase
      .from('payroll_entries')
      .select('gross_amount, bonus_amount, deduction_amount')
      .eq('id', params.id)
      .maybeSingle();
    if (current) {
      const g = patch.gross_amount ?? Number(current.gross_amount ?? 0);
      const b = patch.bonus_amount ?? Number(current.bonus_amount ?? 0);
      const d = patch.deduction_amount ?? Number(current.deduction_amount ?? 0);
      patch.net_amount = Number((g + b - d).toFixed(2));
    }
  }

  const { data, error } = await supabase
    .from('payroll_entries')
    .update(patch)
    .eq('id', params.id)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createClient();
  // Clear the linked ledger row first so it doesn't dangle once the payroll
  // row is gone. This is only used when a mistake row needs undoing;
  // historical records normally stay as status='cancelled'.
  const { data: existing } = await supabase
    .from('payroll_entries')
    .select('financial_txn_id')
    .eq('id', params.id)
    .maybeSingle();
  if (existing?.financial_txn_id) {
    await supabase
      .from('financial_transactions')
      .delete()
      .eq('id', existing.financial_txn_id);
  }
  const { error } = await supabase.from('payroll_entries').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
