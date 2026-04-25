import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { reimbursementProposeSchema } from '@/lib/schemas/finance';

const SELECT_COLS =
  '*, profile:profiles!reimbursement_requests_profile_id_fkey(id, full_name, role, is_active),' +
  ' category:reimbursement_categories!reimbursement_requests_category_id_fkey(id, name, slug, icon)';

/**
 * GET /api/finance/reimbursements
 * Admin: lists every request (with filters); sitter: own requests only.
 * Query params: ?status=pending|approved|rejected|paid|cancelled
 *               ?profile_id=...   (admin-only filter)
 *               ?from=YYYY-MM-DD  expense_date >= from
 *               ?to=YYYY-MM-DD    expense_date <= to
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const profileId = url.searchParams.get('profile_id');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  let q = supabase
    .from('reimbursement_requests')
    .select(SELECT_COLS)
    .order('created_at', { ascending: false });

  if (user.profile.role !== 'admin') {
    q = q.eq('profile_id', user.authId);
  } else if (profileId) {
    q = q.eq('profile_id', profileId);
  }
  if (status) q = q.eq('status', status);
  if (from) q = q.gte('expense_date', from);
  if (to) q = q.lte('expense_date', to);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data ?? [] });
}

/**
 * POST /api/finance/reimbursements (multipart/form-data)
 * Sitters propose new reimbursement requests. The request always lands
 * with status='pending' regardless of what the body says.
 *
 * Form fields:
 *   payload: JSON.stringify(ReimbursementProposeInput)  (required)
 *   file:    File          (optional receipt screenshot)
 *
 * Anyone authenticated can submit (sitter or admin); profile_id is taken
 * from the session, never trusted from the body.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const form = await request.formData();
  const rawPayload = form.get('payload');
  if (typeof rawPayload !== 'string') {
    return NextResponse.json({ error: 'Missing payload' }, { status: 400 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawPayload);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
  const parsed = reimbursementProposeSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const file = form.get('file');
  // Sitters never have storage RLS access; service role uploads on their behalf.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const insert = {
    ...parsed.data,
    profile_id: user.authId,
    status: 'pending' as const
  };
  const { data: row, error: insErr } = await supabase
    .from('reimbursement_requests')
    .insert(insert)
    .select('*')
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  if (file instanceof File && file.size > 0) {
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 15MB)' }, { status: 400 });
    }
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 10);
    const path = `reimbursements/${row.id}/receipt-${Date.now()}-${Math.random()
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

    // Sitter cannot update arbitrary columns under RLS, so use service role.
    await admin
      .from('reimbursement_requests')
      .update({
        receipt_url: signed?.signedUrl ?? null,
        receipt_path: path
      })
      .eq('id', row.id);
  }

  const { data: full } = await supabase
    .from('reimbursement_requests')
    .select(SELECT_COLS)
    .eq('id', row.id)
    .maybeSingle();

  return NextResponse.json({ request: full ?? row }, { status: 201 });
}
