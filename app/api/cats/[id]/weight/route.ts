import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { weightLogSchema } from '@/lib/schemas/weight';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 500);

  const supabase = createClient();
  const { data, error } = await supabase
    .from('weight_logs')
    .select('*, submitter:profiles!weight_logs_submitted_by_fkey(id, full_name)')
    .eq('cat_id', params.id)
    .order('recorded_at', { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data ?? [] });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const body = await request.json();
  const parsed = weightLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('weight_logs')
    .insert({
      cat_id: params.id,
      weight_kg: parsed.data.weight_kg,
      recorded_at: parsed.data.recorded_at,
      photo_url: parsed.data.photo_url ?? null,
      notes: parsed.data.notes ?? null,
      submitted_by: user.authId
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data }, { status: 201 });
}
