import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { preventiveTreatmentSchema } from '@/lib/schemas/preventive';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('preventive_treatments')
    .select('*, recorder:profiles!preventive_treatments_recorded_by_fkey(id, full_name)')
    .eq('cat_id', params.id)
    .order('administered_date', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ treatments: data ?? [] });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const body = await request.json();
  const parsed = preventiveTreatmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('preventive_treatments')
    .insert({
      cat_id: params.id,
      treatment_type: parsed.data.treatment_type,
      product_name: parsed.data.product_name,
      administered_date: parsed.data.administered_date,
      next_due_date: parsed.data.next_due_date || null,
      notes: parsed.data.notes ?? null,
      recorded_by: user.authId
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ treatment: data }, { status: 201 });
}
