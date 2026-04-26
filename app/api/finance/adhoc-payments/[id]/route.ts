import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { adhocPaymentUpdateSchema } from '@/lib/schemas/finance';

const SELECT_COLS =
  '*, profile:profiles!adhoc_payments_profile_id_fkey(id, full_name, role, is_active),' +
  ' finance_category:transaction_categories!adhoc_payments_finance_category_id_fkey(id, name, slug)';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('adhoc_payments')
    .select(SELECT_COLS)
    .eq('id', params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ payment: data });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = adhocPaymentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('adhoc_payments')
    .update(parsed.data)
    .eq('id', params.id)
    .select(SELECT_COLS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payment: data });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createClient();
  const { data: existing } = await supabase
    .from('adhoc_payments')
    .select('financial_txn_id, payment_proof_path')
    .eq('id', params.id)
    .maybeSingle();
  if (existing?.financial_txn_id) {
    await supabase
      .from('financial_transactions')
      .delete()
      .eq('id', existing.financial_txn_id);
  }
  if (existing?.payment_proof_path) {
    const admin = createServiceRoleClient();
    await admin.storage.from('finance-attachments').remove([existing.payment_proof_path]);
  }

  const { error } = await supabase.from('adhoc_payments').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
