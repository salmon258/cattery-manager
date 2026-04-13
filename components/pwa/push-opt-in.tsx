'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  isPushSupported,
  subscribeToPush,
  registerPushSubscription,
  unregisterPushSubscription
} from '@/lib/push/client';

type Status = 'idle' | 'subscribed' | 'denied' | 'unsupported';

export function PushOptIn() {
  const [status, setStatus] = useState<Status>('idle');
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) { setStatus('unsupported'); return; }
    if (Notification.permission === 'denied') { setStatus('denied'); return; }
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => {
        if (sub) setStatus('subscribed');
      })
    );
  }, []);

  async function handleEnable() {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setStatus('denied'); return; }
      const sub = await subscribeToPush();
      if (!sub) return;
      await registerPushSubscription(sub);
      setStatus('subscribed');
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await unregisterPushSubscription(sub);
      setStatus('idle');
    } finally {
      setLoading(false);
    }
  }

  // Don't render if unsupported, already handled, or user dismissed
  if (status === 'unsupported' || dismissed) return null;
  if (status === 'subscribed') {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
        <Bell className="h-3 w-3 text-green-500" />
        <span>Push notifications on</span>
        <button type="button" onClick={handleDisable} disabled={loading} className="hover:text-foreground ml-auto">
          <BellOff className="h-3 w-3" />
        </button>
      </div>
    );
  }
  if (status === 'denied') return null;

  // idle — prompt
  return (
    <div className="rounded-lg border bg-card p-3 text-sm space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <Bell className="h-4 w-4 text-primary" />
          Enable push notifications
        </div>
        <button type="button" onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground shrink-0">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Get notified for overdue medication doses even when the app is closed.
      </p>
      <Button size="sm" onClick={handleEnable} disabled={loading} className="w-full">
        {loading ? 'Enabling…' : 'Enable notifications'}
      </Button>
    </div>
  );
}
