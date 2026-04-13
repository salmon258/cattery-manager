import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) return NextResponse.json({ step: 'auth.getUser', error: authError.message }, { status: 500 });
  if (!user) return NextResponse.json({ step: 'auth.getUser', user: null });

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  return NextResponse.json({
    auth_user: { id: user.id, email: user.email },
    profile,
    profile_error: profileError?.message ?? null
  });
}
