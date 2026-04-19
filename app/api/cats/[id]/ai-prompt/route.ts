import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { buildCatContext } from '@/lib/ai/cat-context';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  question: z.string().trim().min(1).max(2000)
});

const PROMPT_PREAMBLE =
  "I'm managing a cattery and want your advice about one of my cats. The full on-file record is below — use it as the only factual source, and say so explicitly if the record is missing something relevant. Be practical and flag anything that warrants a veterinarian.";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();
  let context: string;
  try {
    context = await buildCatContext(supabase, params.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load cat';
    return NextResponse.json({ error: msg }, { status: 404 });
  }

  const prompt = `${PROMPT_PREAMBLE}

=== CAT RECORD ===
${context}
=== END CAT RECORD ===

My question: ${parsed.data.question}`;

  return NextResponse.json({ prompt });
}
