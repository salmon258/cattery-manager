import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { financialTypeSchema, transactionCategorySchema } from '@/lib/schemas/finance';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const includeInactive = url.searchParams.get('include_inactive') === '1';

  const supabase = createClient();
  let query = supabase
    .from('transaction_categories')
    .select('*')
    .order('type', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (!includeInactive) query = query.eq('is_active', true);
  if (type) {
    const parsedType = financialTypeSchema.safeParse(type);
    if (parsedType.success) query = query.eq('type', parsedType.data);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ categories: data ?? [] });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = transactionCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('transaction_categories')
    .insert({ ...parsed.data, created_by: user.authId })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data }, { status: 201 });
}
