import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { labResultSchema } from '@/lib/schemas/vet';

/**
 * POST /api/vet-visits/[id]/lab-results
 * All authenticated users — attach a lab result file (already uploaded to storage).
 * Body: { file_url, storage_path, file_type, file_name, file_size_bytes?, notes? }
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const body   = await req.json();
  const parsed = labResultSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('lab_results')
    .insert({ ...parsed.data, vet_visit_id: params.id, uploaded_by: user.profile.id })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lab_result: data }, { status: 201 });
}
