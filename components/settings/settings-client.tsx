'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Settings = {
  cattery_name: string;
  cattery_logo_url: string | null;
  cattery_timezone: string;
  default_currency: string;
  gestation_days: number;
  vaccination_lead_days: number;
  preventive_lead_days: number;
  vet_followup_lead_days: number;
  weight_drop_alert_pct: number;
  push_notifications_enabled: boolean;
};

const COMMON_TIMEZONES = [
  'Asia/Jakarta',       // GMT+7
  'Asia/Makassar',      // GMT+8
  'Asia/Jayapura',      // GMT+9
  'Asia/Singapore',
  'Asia/Kuala_Lumpur',
  'Asia/Bangkok',
  'Asia/Ho_Chi_Minh',
  'Asia/Manila',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC'
];

export function SettingsClient() {
  const t  = useTranslations('settings');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<Settings>({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const r = await fetch('/api/settings', { cache: 'no-store' });
      if (!r.ok) throw new Error('Failed');
      return (await r.json()).settings;
    }
  });

  const [form, setForm] = useState<Settings | null>(null);
  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: async (payload: Partial<Settings>) => {
      const r = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
      return (await r.json()).settings;
    },
    onSuccess: (next) => {
      toast.success(t('saved'));
      qc.setQueryData(['system-settings'], next);
    },
    onError: (e: Error) => toast.error(e.message)
  });

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    save.mutate(form);
  }

  if (isLoading || !form) {
    return <p className="text-sm text-muted-foreground">{tc('loading')}</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Button type="submit" disabled={save.isPending}>
          <Save className="h-4 w-4" /> {save.isPending ? tc('saving') : tc('save')}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t('sections.branding')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ss-name">{t('fields.catteryName')}</Label>
            <Input id="ss-name" value={form.cattery_name} onChange={(e) => update('cattery_name', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ss-logo">{t('fields.logoUrl')}</Label>
            <Input
              id="ss-logo"
              type="url"
              value={form.cattery_logo_url ?? ''}
              onChange={(e) => update('cattery_logo_url', e.target.value || null)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ss-currency">{t('fields.currency')}</Label>
            <Input
              id="ss-currency"
              value={form.default_currency}
              onChange={(e) => update('default_currency', e.target.value.toUpperCase())}
              maxLength={10}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ss-tz">{t('fields.timezone')}</Label>
            <select
              id="ss-tz"
              value={form.cattery_timezone}
              onChange={(e) => update('cattery_timezone', e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {!COMMON_TIMEZONES.includes(form.cattery_timezone) && (
                <option value={form.cattery_timezone}>{form.cattery_timezone}</option>
              )}
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t('hints.timezone')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t('sections.health')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <NumberRow
            id="ss-gest"
            label={t('fields.gestation')}
            help={t('hints.gestation')}
            min={30} max={120}
            value={form.gestation_days}
            onChange={(v) => update('gestation_days', v)}
          />
          <NumberRow
            id="ss-vac"
            label={t('fields.vaccLead')}
            help={t('hints.leadDays')}
            min={0} max={60}
            value={form.vaccination_lead_days}
            onChange={(v) => update('vaccination_lead_days', v)}
          />
          <NumberRow
            id="ss-prev"
            label={t('fields.prevLead')}
            help={t('hints.leadDays')}
            min={0} max={60}
            value={form.preventive_lead_days}
            onChange={(v) => update('preventive_lead_days', v)}
          />
          <NumberRow
            id="ss-vet"
            label={t('fields.vetLead')}
            help={t('hints.leadDays')}
            min={0} max={60}
            value={form.vet_followup_lead_days}
            onChange={(v) => update('vet_followup_lead_days', v)}
          />
          <NumberRow
            id="ss-wdrop"
            label={t('fields.weightDropAlert')}
            help={t('hints.weightDrop')}
            min={1} max={50}
            value={form.weight_drop_alert_pct}
            onChange={(v) => update('weight_drop_alert_pct', v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t('sections.notifications')}</CardTitle></CardHeader>
        <CardContent>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.push_notifications_enabled}
              onChange={(e) => update('push_notifications_enabled', e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <span className="text-sm">{t('fields.pushEnabled')}</span>
          </label>
        </CardContent>
      </Card>
    </form>
  );
}

function NumberRow({
  id, label, help, min, max, value, onChange
}: {
  id: string; label: string; help?: string; min: number; max: number; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min} max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!isNaN(n)) onChange(n);
        }}
      />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}
