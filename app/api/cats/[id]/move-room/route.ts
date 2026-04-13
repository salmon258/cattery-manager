import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { moveCatSchema } from '@/lib/schemas/rooms';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = moveCatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();
  // supabase gen types marks p_to_room_id / p_reason as non-nullable, but the
  // SQL function accepts NULL for both ("unassigned", "no reason"). Cast to
  // relax the generated arg types without losing runtime semantics.
  const { data, error } = await supabase.rpc('move_cat', {
    p_cat_id: params.id,
    p_to_room_id: parsed.data.to_room_id as string,
    p_reason: (parsed.data.reason ?? null) as string
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cat: data });
}
