import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

/**
 * DELETE /api/vet-visits/[id]/lab-results/[labId]
 * Admin only — remove a lab result / receipt attachment from a visit. The
 * underlying storage object is left in place (RLS on the `lab-results`
 * bucket already allows admin-only deletes and the orphan is cheap).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; labId: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('lab_results')
    .delete()
    .eq('id', params.labId)
    .eq('vet_visit_id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
