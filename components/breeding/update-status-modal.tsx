'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

type MatingStatus = 'planned' | 'confirmed' | 'pregnant' | 'delivered' | 'failed';

interface Props {
  open: boolean;
  onClose: () => void;
  recordId: string;
  currentStatus: MatingStatus;
  catId: string;
}

export function UpdateStatusModal({ open, onClose, recordId, currentStatus, catId }: Props) {
  const t  = useTranslations('breeding');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<MatingStatus>(currentStatus);
  const [notes, setNotes]   = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const r = await fetch(`/api/mating-records/${recordId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status, notes: notes || null })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
      toast.success(t('statusUpdated'));
      qc.invalidateQueries({ queryKey: ['mating-records', catId] });
      qc.invalidateQueries({ queryKey: ['mating-records'] });
      setNotes('');
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
      onOpenChange={(v) => { if (!v) { setNotes(''); onClose(); } }}
      title={t('updateStatus')}
    >
      <form onSubmit={onSubmit} className="space-y-4 py-2">
        <div className="space-y-1.5">
          <Label>{t('fields.status')}</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as MatingStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(['planned', 'confirmed', 'pregnant', 'delivered', 'failed'] as const).map((s) => (
                <SelectItem key={s} value={s}>{t(`statuses.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="us-notes">{tc('notes')}</Label>
          <Textarea
            id="us-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={tc('optional')}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button type="submit" disabled={submitting}>{submitting ? tc('saving') : tc('save')}</Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
