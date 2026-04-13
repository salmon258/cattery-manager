import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { catUpdateSchema } from '@/lib/schemas/cats';
import type { Database } from '@/lib/supabase/types';

type CatUpdate = Database['public']['Tables']['cats']['Update'];

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase.from('cats').select('*').eq('id', params.id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const { data: photos } = await supabase
    .from('cat_photos')
    .select('*')
    .eq('cat_id', params.id)
    .order('sort_order', { ascending: true });

  return NextResponse.json({ cat: data, photos: photos ?? [] });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = catUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });

  const supabase = createClient();
  const updates: CatUpdate = { ...parsed.data };
  if (parsed.data.status && ['deceased', 'sold'].includes(parsed.data.status)) {
    updates.status_changed_at = new Date().toISOString().slice(0, 10);
  }

  const { data, error } = await supabase
    .from('cats')
    .update(updates)
    .eq('id', params.id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cat: data });
}
