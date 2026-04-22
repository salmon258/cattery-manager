import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { medicationSchema } from '@/lib/schemas/medications';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const url = new URL(request.url);
  const includeInactive = url.searchParams.get('include_inactive') === '1';

  const supabase = createClient();
  let query = supabase
    .from('medications')
    .select('*')
    .eq('cat_id', params.id)
    .order('start_date', { ascending: false });
  if (!includeInactive) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ medications: data ?? [] });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (!user.profile.is_active) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = medicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('medications')
    .insert({
      cat_id: params.id,
      medicine_name: parsed.data.medicine_name,
      dose: parsed.data.dose,
      route: parsed.data.route,
      start_date: parsed.data.start_date,
      // end_date is nullable in the DB (indefinite schedules). The generated
      // Supabase types haven't been regenerated yet so we cast the client.
      end_date: parsed.data.end_date ?? null,
      interval_days: parsed.data.interval_days,
      time_slots: parsed.data.time_slots,
      notes: parsed.data.notes ?? null,
      is_active: parsed.data.is_active ?? true,
      created_by: user.authId
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ medication: data }, { status: 201 });
}
