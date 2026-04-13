import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function signout(request: Request) {
  const supabase = createClient();
  await supabase.auth.signOut();
  const origin = new URL(request.url).origin;
  return NextResponse.redirect(`${origin}/login`, { status: 303 });
}

export const POST = signout;
export const GET = signout;
