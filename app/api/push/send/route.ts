import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

// Admin-only: send a push notification to a specific user or broadcast.
// Body: { user_id?: string, title: string, body: string, url?: string }
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify admin
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: 'Push notifications not configured (missing VAPID keys)' }, { status: 501 });
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
    vapidPublic,
    vapidPrivate
  );

  const { user_id, title, body, url } = await req.json() as {
    user_id?: string;
    title: string;
    body: string;
    url?: string;
  };

  const serviceClient = createServiceRoleClient();
  let query = serviceClient.from('push_subscriptions').select('endpoint, p256dh, auth');
  if (user_id) query = query.eq('user_id', user_id);

  const { data: subs, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!subs?.length) return NextResponse.json({ sent: 0 });

  const payload = JSON.stringify({ title, body, url: url ?? '/' });
  const results = await Promise.allSettled(
    (subs as Array<{ endpoint: string; p256dh: string; auth: string }>).map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      )
    )
  );

  // Remove subscriptions that are no longer valid (410 Gone)
  const gone: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected' && (r.reason as { statusCode?: number })?.statusCode === 410) {
      gone.push((subs as Array<{ endpoint: string }>)[i].endpoint);
    }
  });
  if (gone.length) {
    await serviceClient.from('push_subscriptions').delete().in('endpoint', gone);
  }

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return NextResponse.json({ sent, failed: results.length - sent });
}
