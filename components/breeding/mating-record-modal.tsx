'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

interface CatOption { id: string; name: string; breed: string | null }

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-fill: the cat whose detail page this was opened from */
  prefilledCat?: { id: string; name: string; gender: 'male' | 'female' };
}

export function MatingRecordModal({ open, onClose, prefilledCat }: Props) {
  const t  = useTranslations('breeding');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const today = new Date().toISOString().split('T')[0];

  const [submitting, setSubmitting]     = useState(false);
  const [femaleCatId, setFemaleCatId]   = useState(
    prefilledCat?.gender === 'female' ? prefilledCat.id : ''
  );
  const [maleCatId, setMaleCatId]       = useState(
    prefilledCat?.gender === 'male' ? prefilledCat.id : ''
  );
  const [matingDate, setMatingDate]     = useState(today);
  const [method, setMethod]             = useState<'natural' | 'ai'>('natural');
  const [notes, setNotes]               = useState('');

  // Reset when reopened with a different prefilled cat
  useEffect(() => {
    if (open) {
      setFemaleCatId(prefilledCat?.gender === 'female' ? prefilledCat.id : '');
      setMaleCatId(prefilledCat?.gender === 'male' ? prefilledCat.id : '');
      setMatingDate(today);
      setMethod('natural');
      setNotes('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fetch female cats (for selector when prefilled is male or no prefill)
  const { data: femaleCats = [] } = useQuery<CatOption[]>({
    queryKey: ['cats-female'],
    queryFn: async () => {
      const r = await fetch('/api/cats?status=active', { cache: 'no-store' });
      if (!r.ok) return [];
      const { cats } = await r.json();
      return cats.filter((c: { gender: string }) => c.gender === 'female');
    },
    enabled: open && prefilledCat?.gender !== 'female'
  });

  // Fetch male cats (for selector when prefilled is female or no prefill)
  const { data: maleCats = [] } = useQuery<CatOption[]>({
    queryKey: ['cats-male'],
    queryFn: async () => {
      const r = await fetch('/api/cats?status=active', { cache: 'no-store' });
      if (!r.ok) return [];
      const { cats } = await r.json();
      return cats.filter((c: { gender: string }) => c.gender === 'male');
    },
    enabled: open && prefilledCat?.gender !== 'male'
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!femaleCatId || !maleCatId) {
      toast.error(t('errors.selectBothCats'));
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/mating-records', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          female_cat_id: femaleCatId,
          male_cat_id: maleCatId,
          mating_date: matingDate,
          mating_method: method,
          notes: notes || null
        })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
      toast.success(t('matingCreated'));
      qc.invalidateQueries({ queryKey: ['mating-records'] });
      if (prefilledCat) qc.invalidateQueries({ queryKey: ['mating-records', prefilledCat.id] });
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
      title={t('newMating')}
    >
      <form onSubmit={onSubmit} className="space-y-4 py-2">
        {/* Female cat */}
        <div className="space-y-1.5">
          <Label>{t('fields.femaleCat')}</Label>
          {prefilledCat?.gender === 'female' ? (
            <p className="text-sm font-medium">{prefilledCat.name}</p>
          ) : (
            <Select value={femaleCatId} onValueChange={setFemaleCatId}>
              <SelectTrigger><SelectValue placeholder={t('placeholders.selectFemale')} /></SelectTrigger>
              <SelectContent>
                {femaleCats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}{c.breed ? ` (${c.breed})` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Male cat */}
        <div className="space-y-1.5">
          <Label>{t('fields.maleCat')}</Label>
          {prefilledCat?.gender === 'male' ? (
            <p className="text-sm font-medium">{prefilledCat.name}</p>
          ) : (
            <Select value={maleCatId} onValueChange={setMaleCatId}>
              <SelectTrigger><SelectValue placeholder={t('placeholders.selectMale')} /></SelectTrigger>
              <SelectContent>
                {maleCats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}{c.breed ? ` (${c.breed})` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Mating date */}
        <div className="space-y-1.5">
          <Label htmlFor="mr-date">{t('fields.matingDate')}</Label>
          <Input id="mr-date" type="date" value={matingDate} onChange={(e) => setMatingDate(e.target.value)} required />
        </div>

        {/* Method */}
        <div className="space-y-1.5">
          <Label htmlFor="mr-method">{t('fields.method')}</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as 'natural' | 'ai')}>
            <SelectTrigger id="mr-method"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="natural">{t('methods.natural')}</SelectItem>
              <SelectItem value="ai">{t('methods.ai')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="mr-notes">{tc('notes')}</Label>
          <Textarea id="mr-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button type="submit" disabled={submitting}>{submitting ? tc('saving') : tc('create')}</Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}

