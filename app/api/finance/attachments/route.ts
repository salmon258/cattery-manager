import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

/**
 * POST /api/finance/attachments  (admin only, multipart/form-data)
 * Form fields:
 *   file:    File (pdf or image)
 *   kind:    'payroll' | 'receipt'  (controls key prefix)
 *   key:     optional sub-path segment (e.g. payroll entry id, transaction id)
 *
 * Returns { path, url }. `url` is a long-life signed URL suitable for
 * embedding in a `transfer_proof_url` / `receipt_url` column; the app
 * always re-signs via /payroll/[id]/proof for display.
 *
 * Bucket `finance-attachments` is private, so we use the standard signed
 * URL flow. Admins can still fetch the file directly via RLS.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const form = await request.formData();
  const file = form.get('file');
  const kind = String(form.get('kind') ?? 'receipt');
  const key = String(form.get('key') ?? 'misc');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 15MB)' }, { status: 400 });
  }
  if (!['payroll', 'receipt'].includes(kind)) {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  }

  const supabase = createClient();
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 10);
  const path = `${kind}/${key}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from('finance-attachments')
    .upload(path, buf, {
      contentType: file.type || 'application/octet-stream',
      cacheControl: '3600',
      upsert: false
    });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // A 30-day signed URL is practical to drop straight into the `receipt_url`
  // column — the bucket is private so this is the only way to preview.
  // Sitters viewing payroll proofs always go through the dedicated route so
  // they get a fresh signed URL.
  const { data: signed } = await supabase.storage
    .from('finance-attachments')
    .createSignedUrl(path, 60 * 60 * 24 * 30);

  return NextResponse.json({ path, url: signed?.signedUrl ?? null }, { status: 201 });
}
