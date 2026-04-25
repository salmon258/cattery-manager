import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

/**
 * GET /api/finance/reimbursements/[id]/receipt
 * Returns a fresh signed URL for the sitter-uploaded receipt screenshot.
 * Owner + admin can fetch.
 */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: row, error } = await supabase
    .from('reimbursement_requests')
    .select('profile_id, receipt_path')
    .eq('id', params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isOwner = row.profile_id === user.authId;
  const isAdmin = user.profile.role === 'admin';
  if (!isOwner && !isAdmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!row.receipt_path)
    return NextResponse.json({ error: 'No receipt attached' }, { status: 404 });

  const admin = createServiceRoleClient();
  const { data: signed, error: signErr } = await admin.storage
    .from('finance-attachments')
    .createSignedUrl(row.receipt_path, 60 * 60);
  if (signErr || !signed) {
    return NextResponse.json(
      { error: signErr?.message ?? 'Failed to sign URL' },
      { status: 500 }
    );
  }
  return NextResponse.json({ url: signed.signedUrl });
}
