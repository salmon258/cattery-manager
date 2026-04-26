import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

/**
 * GET /api/finance/payroll/[id]/proof
 * Returns a short-lived signed URL for the transfer-proof file linked to a
 * payroll entry. Admin can fetch any entry's proof; sitters can fetch only
 * their own. The bucket itself is private, so this route is the only way
 * to view a proof from the browser.
 */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();
  const { data: entry, error } = await supabase
    .from('payroll_entries')
    .select('profile_id, transfer_proof_path, transfer_proof_url')
    .eq('id', params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isOwner = entry.profile_id === user.authId;
  const isAdmin = user.profile.role === 'admin';
  if (!isOwner && !isAdmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!entry.transfer_proof_path) {
    return NextResponse.json({ error: 'No proof attached' }, { status: 404 });
  }

  // Signed URLs require the service-role client because the bucket RLS only
  // permits admins. One hour is plenty for an in-browser view.
  const admin = createServiceRoleClient();
  const { data: signed, error: signErr } = await admin.storage
    .from('finance-attachments')
    .createSignedUrl(entry.transfer_proof_path, 60 * 60);
  if (signErr || !signed) {
    return NextResponse.json(
      { error: signErr?.message ?? 'Failed to sign URL' },
      { status: 500 }
    );
  }
  return NextResponse.json({ url: signed.signedUrl });
}

/**
 * DELETE /api/finance/payroll/[id]/proof — admin only.
 * Removes the stored file and clears the transfer_proof_* columns on the
 * payroll entry.
 */
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createClient();
  const { data: entry } = await supabase
    .from('payroll_entries')
    .select('transfer_proof_path')
    .eq('id', params.id)
    .maybeSingle();

  if (entry?.transfer_proof_path) {
    await supabase.storage.from('finance-attachments').remove([entry.transfer_proof_path]);
  }
  const { error } = await supabase
    .from('payroll_entries')
    .update({ transfer_proof_url: null, transfer_proof_path: null })
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
