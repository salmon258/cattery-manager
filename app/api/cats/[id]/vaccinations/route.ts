import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { vaccinationSchema } from '@/lib/schemas/vaccinations';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('vaccinations')
    .select('*, recorder:profiles!vaccinations_recorded_by_fkey(id, full_name)')
    .eq('cat_id', params.id)
    .order('administered_date', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vaccinations: data ?? [] });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const body = await request.json();
  const parsed = vaccinationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('vaccinations')
    .insert({
      cat_id: params.id,
      vaccine_type: parsed.data.vaccine_type,
      vaccine_name: parsed.data.vaccine_name ?? null,
      administered_date: parsed.data.administered_date,
      batch_number: parsed.data.batch_number ?? null,
      administered_by_vet: parsed.data.administered_by_vet ?? null,
      next_due_date: parsed.data.next_due_date || null,
      notes: parsed.data.notes ?? null,
      recorded_by: user.authId
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vaccination: data }, { status: 201 });
}
