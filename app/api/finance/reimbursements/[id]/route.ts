import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { reimbursementUpdateSchema } from '@/lib/schemas/finance';
import type { Database } from '@/lib/supabase/types';

type ReimbursementUpdate = Database['public']['Tables']['reimbursement_requests']['Update'];

const SELECT_COLS =
  '*, profile:profiles!reimbursement_requests_profile_id_fkey(id, full_name, role, is_active),' +
  ' category:reimbursement_categories!reimbursement_requests_category_id_fkey(id, name, slug, icon)';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('reimbursement_requests')
    .select(SELECT_COLS)
    .eq('id', params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ request: data });
}

/**
 * PATCH /api/finance/reimbursements/[id]
 * Admin: any field, including status transitions and payment fields.
 * Sitter (owner): only while pending — limited to category, amount, currency,
 *                 expense_date, description, or self-cancel via status='cancelled'.
 *
 * When admin transitions to 'approved', 'rejected' or 'paid', reviewed_by
 * and reviewed_at are stamped server-side (a sitter can never reach those
 * statuses).
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const body = await request.json();
  const parsed = reimbursementUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createClient();
  const { data: existing, error: fErr } = await supabase
    .from('reimbursement_requests')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAdmin = user.profile.role === 'admin';
  const isOwner = existing.profile_id === user.authId;
  if (!isAdmin && !isOwner)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Build patch with role-based field whitelist.
  const patch: ReimbursementUpdate = {};
  if (isAdmin) {
    Object.assign(patch, parsed.data);
    // Stamp reviewer when status moves into a reviewed state.
    if (
      parsed.data.status &&
      parsed.data.status !== existing.status &&
      ['approved', 'rejected', 'paid'].includes(parsed.data.status)
    ) {
      patch.reviewed_by = user.authId;
      patch.reviewed_at = new Date().toISOString();
    }
  } else {
    // Owner-only: lock down to safe fields, and only when still pending.
    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending requests can be edited' },
        { status: 400 }
      );
    }
    if (parsed.data.category_id !== undefined) patch.category_id = parsed.data.category_id;
    if (parsed.data.amount !== undefined) patch.amount = parsed.data.amount;
    if (parsed.data.currency !== undefined) patch.currency = parsed.data.currency;
    if (parsed.data.expense_date !== undefined) patch.expense_date = parsed.data.expense_date;
    if (parsed.data.description !== undefined) patch.description = parsed.data.description;
    // Self-cancel only.
    if (parsed.data.status !== undefined) {
      if (parsed.data.status !== 'cancelled') {
        return NextResponse.json(
          { error: 'Only cancellation is allowed' },
          { status: 403 }
        );
      }
      patch.status = 'cancelled';
    }
  }

  const { data, error } = await supabase
    .from('reimbursement_requests')
    .update(patch)
    .eq('id', params.id)
    .select(SELECT_COLS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();
  const { data: existing } = await supabase
    .from('reimbursement_requests')
    .select('profile_id, status, financial_txn_id, receipt_path, payment_proof_path')
    .eq('id', params.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAdmin = user.profile.role === 'admin';
  const isOwner = existing.profile_id === user.authId;
  if (!isAdmin && !(isOwner && existing.status === 'pending'))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Clear up the linked finance row + storage objects.
  const admin = createServiceRoleClient();
  if (existing.financial_txn_id) {
    await supabase
      .from('financial_transactions')
      .delete()
      .eq('id', existing.financial_txn_id);
  }
  const toRemove: string[] = [];
  if (existing.receipt_path) toRemove.push(existing.receipt_path);
  if (existing.payment_proof_path) toRemove.push(existing.payment_proof_path);
  if (toRemove.length) {
    await admin.storage.from('finance-attachments').remove(toRemove);
  }

  const { error } = await supabase
    .from('reimbursement_requests')
    .delete()
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
