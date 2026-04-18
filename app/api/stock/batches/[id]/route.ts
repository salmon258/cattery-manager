import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const [{ data: batch, error: bErr }, { data: moves, error: mErr }] = await Promise.all([
    supabase.from('stock_batches').select('*').eq('id', params.id).maybeSingle(),
    supabase
      .from('stock_movements')
      .select('*')
      .eq('batch_id', params.id)
      .order('moved_at', { ascending: false })
      .limit(200)
  ]);
  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });
  if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  return NextResponse.json({ batch, movements: moves ?? [] });
}
