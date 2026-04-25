import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

/**
 * GET — owner + admin can fetch a fresh signed URL for the admin-uploaded
 * payment proof on an ad-hoc payment.
 */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: row, error } = await supabase
    .from('adhoc_payments')
    .select('profile_id, payment_proof_path')
    .eq('id', params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isOwner = row.profile_id === user.authId;
  const isAdmin = user.profile.role === 'admin';
  if (!isOwner && !isAdmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!row.payment_proof_path)
    return NextResponse.json({ error: 'No payment proof attached' }, { status: 404 });

  const admin = createServiceRoleClient();
  const { data: signed, error: signErr } = await admin.storage
    .from('finance-attachments')
    .createSignedUrl(row.payment_proof_path, 60 * 60);
  if (signErr || !signed) {
    return NextResponse.json(
      { error: signErr?.message ?? 'Failed to sign URL' },
      { status: 500 }
    );
  }
  return NextResponse.json({ url: signed.signedUrl });
}

/**
 * POST — admin uploads a payment proof and (optionally) marks the payment
 * paid in the same call.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const form = await request.formData();
  const file = form.get('file');
  const paymentDate = String(form.get('payment_date') ?? '').trim();
  const paymentMethod = String(form.get('payment_method') ?? '').trim();
  const paymentReference = String(form.get('payment_reference') ?? '').trim();
  const markPaid = String(form.get('mark_paid') ?? '') === '1';

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 15MB)' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 10);
  const path = `adhoc/${params.id}/payment-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from('finance-attachments')
    .upload(path, buf, {
      contentType: file.type || 'application/octet-stream',
      cacheControl: '3600',
      upsert: false
    });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: signed } = await admin.storage
    .from('finance-attachments')
    .createSignedUrl(path, 60 * 60 * 24 * 30);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {
    payment_proof_url: signed?.signedUrl ?? null,
    payment_proof_path: path
  };
  if (paymentDate) patch.payment_date = paymentDate;
  if (paymentMethod) patch.payment_method = paymentMethod;
  if (paymentReference) patch.payment_reference = paymentReference;
  if (markPaid) patch.status = 'paid';

  const { data, error } = await supabase
    .from('adhoc_payments')
    .update(patch)
    .eq('id', params.id)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payment: data });
}
