import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { buildCatContext } from '@/lib/ai/cat-context';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const bodySchema = z.object({
  question: z.string().trim().min(1).max(2000)
});

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-7';

// Static, stable preamble — sits before the (cached) cat context so we don't
// burn cache invalidation every time the context changes for a specific cat.
const SYSTEM_PREAMBLE = `You are a knowledgeable feline-health assistant advising a cattery manager.
Use the provided cat profile as the sole factual source about this cat; do not
invent data. When the record is missing something relevant to the question,
say so explicitly rather than guessing. Give practical, cattery-appropriate
advice; flag anything that warrants a veterinarian. Be concise (a few short
paragraphs or a bulleted list) and refer to the cat by name.`;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI is not configured on this server (ANTHROPIC_API_KEY missing).' },
      { status: 503 }
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createClient();
  let context: string;
  try {
    context = await buildCatContext(supabase, params.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load cat';
    return NextResponse.json({ error: msg }, { status: 404 });
  }

  const client = new Anthropic({ apiKey });

  try {
    // Prompt caching strategy: the cat context is stable across follow-up
    // questions about the same cat, so we put it in a system block with a
    // cache breakpoint. The varying question lives in the user message,
    // after the breakpoint — so repeated follow-ups read the cached prefix.
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: [
        { type: 'text', text: SYSTEM_PREAMBLE },
        {
          type: 'text',
          text: `The following is the complete known record for this cat:\n\n${context}`,
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages: [{ role: 'user', content: parsed.data.question }]
    });

    const answer = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    if (!answer) {
      return NextResponse.json(
        { error: 'The AI did not return a response. Try rephrasing the question.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      answer,
      model: response.model,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
        cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0
      },
      context
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'AI is rate-limited, please retry shortly.' }, { status: 429 });
    }
    if (e instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: 'AI credentials are invalid.' }, { status: 500 });
    }
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `AI error: ${e.message}` }, { status: 502 });
    }
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
