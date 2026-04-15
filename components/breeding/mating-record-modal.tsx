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

interface CatOption { id: string; name: string; breed: string | null; gender: 'male' | 'female' }

type MatingMethod = 'natural' | 'ai';

export interface EditingMatingRecord {
  id: string;
  female_cat_id: string;
  male_cat_id: string;
  mating_date: string;
  mating_method: MatingMethod;
  notes: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-fill: the cat whose detail page this was opened from */
  prefilledCat?: { id: string; name: string; gender: 'male' | 'female' };
  /** When provided, the modal runs in "edit" mode against this record. */
  editing?: EditingMatingRecord | null;
}

export function MatingRecordModal({ open, onClose, prefilledCat, editing }: Props) {
  const t  = useTranslations('breeding');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const isEdit = !!editing;
  const today  = new Date().toISOString().split('T')[0];

  const [submitting, setSubmitting]     = useState(false);
  const [femaleCatId, setFemaleCatId]   = useState('');
  const [maleCatId, setMaleCatId]       = useState('');
  const [matingDate, setMatingDate]     = useState(today);
  const [method, setMethod]             = useState<MatingMethod>('natural');
  const [notes, setNotes]               = useState('');

  // Reset/prefill whenever the modal opens or the editing target changes.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setFemaleCatId(editing.female_cat_id);
      setMaleCatId(editing.male_cat_id);
      setMatingDate(editing.mating_date);
      setMethod(editing.mating_method);
      setNotes(editing.notes ?? '');
    } else {
      setFemaleCatId(prefilledCat?.gender === 'female' ? prefilledCat.id : '');
      setMaleCatId(prefilledCat?.gender === 'male' ? prefilledCat.id : '');
      setMatingDate(today);
      setMethod('natural');
      setNotes('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  // Fetch all active cats once; split into male/female below. In edit mode we
  // always want both dropdowns populated (since both may be swapped), and the
  // list is short enough that filtering client-side is fine.
  const { data: allCats = [] } = useQuery<CatOption[]>({
    queryKey: ['cats-by-gender'],
    queryFn: async () => {
      const r = await fetch('/api/cats?status=active', { cache: 'no-store' });
      if (!r.ok) return [];
      const { cats } = await r.json();
      return (cats as CatOption[]).filter((c) => c.gender === 'male' || c.gender === 'female');
    },
    enabled: open
  });
  const femaleCats = allCats.filter((c) => c.gender === 'female');
  const maleCats   = allCats.filter((c) => c.gender === 'male');

  // In edit mode we show both selectors freely. In create mode we keep the
  // original behavior of locking the prefilled cat to a plain label.
  const lockFemale = !isEdit && prefilledCat?.gender === 'female';
  const lockMale   = !isEdit && prefilledCat?.gender === 'male';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!femaleCatId || !maleCatId) {
      toast.error(t('errors.selectBothCats'));
      return;
    }
    if (femaleCatId === maleCatId) {
      toast.error(t('errors.selectBothCats'));
      return;
    }
    setSubmitting(true);
    try {
      const url    = isEdit ? `/api/mating-records/${editing!.id}` : '/api/mating-records';
      const method_ = isEdit ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method: method_,
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
      toast.success(isEdit ? t('matingUpdated') : t('matingCreated'));
      qc.invalidateQueries({ queryKey: ['mating-records'] });
      if (prefilledCat) qc.invalidateQueries({ queryKey: ['mating-records', prefilledCat.id] });
      // Invalidate the detail pages of both sides of the mating so their
      // cards refresh even when we're not opened from their page.
      qc.invalidateQueries({ queryKey: ['mating-records', femaleCatId] });
      qc.invalidateQueries({ queryKey: ['mating-records', maleCatId] });
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
      title={isEdit ? t('editMating') : t('newMating')}
    >
      <form onSubmit={onSubmit} className="space-y-4 py-2">
        {/* Female cat */}
        <div className="space-y-1.5">
          <Label>{t('fields.femaleCat')}</Label>
          {lockFemale ? (
            <p className="text-sm font-medium">{prefilledCat!.name}</p>
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
          {lockMale ? (
            <p className="text-sm font-medium">{prefilledCat!.name}</p>
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
          <Select value={method} onValueChange={(v) => setMethod(v as MatingMethod)}>
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
          <Button type="submit" disabled={submitting}>
            {submitting ? tc('saving') : (isEdit ? tc('save') : tc('create'))}
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
