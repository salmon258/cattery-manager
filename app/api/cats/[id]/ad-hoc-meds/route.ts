import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { adHocMedicineSchema } from '@/lib/schemas/medications';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('ad_hoc_medicines')
    .select('*, submitter:profiles!ad_hoc_medicines_submitted_by_fkey(id, full_name)')
    .eq('cat_id', params.id)
    .order('given_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const body = await request.json();
  const parsed = adHocMedicineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('ad_hoc_medicines')
    .insert({
      cat_id: params.id,
      medicine_name: parsed.data.medicine_name,
      dose: parsed.data.dose ?? null,
      unit: parsed.data.unit ?? null,
      route: parsed.data.route,
      given_at: parsed.data.given_at,
      notes: parsed.data.notes ?? null,
      submitted_by: user.authId
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data }, { status: 201 });
}
