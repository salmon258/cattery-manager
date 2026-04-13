// Background sync flush — processes queued offline actions (e.g. task confirms)
// Called by the service worker when the browser comes back online.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { actions?: Array<{ action: string; payload: Record<string, unknown> }> };
  const actions = body.actions ?? [];

  const results: Array<{ ok: boolean; error?: string }> = [];

  for (const item of actions) {
    if (item.action === 'confirm_task') {
      const taskId = item.payload.task_id as string;
      const { error } = await supabase
        .from('medication_tasks')
        .update({
          confirmed_at: new Date().toISOString(),
          confirmed_by: user.id,
          skipped: false,
          skip_reason: null
        })
        .eq('id', taskId)
        .is('confirmed_at', null);
      results.push(error ? { ok: false, error: error.message } : { ok: true });
    } else {
      results.push({ ok: false, error: `Unknown action: ${item.action}` });
    }
  }

  return NextResponse.json({ results });
}
