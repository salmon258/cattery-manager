'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

interface Props {
  open: boolean;
  onClose: () => void;
  catId: string;
  catName?: string;
}

export function HeatLogModal({ open, onClose, catId, catName }: Props) {
  const t  = useTranslations('breeding');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const today = new Date().toISOString().split('T')[0];
  const [submitting, setSubmitting] = useState(false);
  const [date, setDate]         = useState(today);
  const [intensity, setIntensity] = useState<'mild' | 'moderate' | 'strong'>('mild');
  const [notes, setNotes]       = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const r = await fetch(`/api/cats/${catId}/heat-logs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ observed_date: date, intensity, notes: notes || null })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
      toast.success(t('heatLogged'));
      qc.invalidateQueries({ queryKey: ['heat-logs', catId] });
      setDate(today); setIntensity('mild'); setNotes('');
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      title={catName ? `${t('logHeat')} — ${catName}` : t('logHeat')}
    >
      <form onSubmit={onSubmit} className="space-y-4 py-2">
        <div className="space-y-1.5">
          <Label htmlFor="hl-date">{t('fields.observedDate')}</Label>
          <Input id="hl-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hl-intensity">{t('fields.intensity')}</Label>
          <Select value={intensity} onValueChange={(v) => setIntensity(v as typeof intensity)}>
            <SelectTrigger id="hl-intensity"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(['mild', 'moderate', 'strong'] as const).map((s) => (
                <SelectItem key={s} value={s}>{t(`intensities.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hl-notes">{tc('notes')}</Label>
          <Textarea id="hl-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button type="submit" disabled={submitting}>{submitting ? tc('saving') : tc('save')}</Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
