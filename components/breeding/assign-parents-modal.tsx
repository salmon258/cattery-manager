'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

interface CatOption {
  id: string;
  name: string;
  breed: string | null;
  gender: 'male' | 'female';
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** The cat whose parents we're assigning (the "kitten"). */
  catId: string;
  catName: string;
  currentMotherId: string | null;
  currentFatherId: string | null;
}

const UNSET = '__unset__';

/**
 * Admin-only modal for manually assigning a mother and/or father to an
 * existing cat. Used for cats that were born before the app was adopted, or
 * for fixing historical data. Mother list is filtered to females, father list
 * to males, and the cat itself is excluded from both.
 */
export function AssignParentsModal({
  open, onClose, catId, catName, currentMotherId, currentFatherId
}: Props) {
  const t  = useTranslations('breeding');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const [submitting, setSubmitting] = useState(false);
  const [motherId, setMotherId]     = useState<string>(currentMotherId ?? UNSET);
  const [fatherId, setFatherId]     = useState<string>(currentFatherId ?? UNSET);

  useEffect(() => {
    if (open) {
      setMotherId(currentMotherId ?? UNSET);
      setFatherId(currentFatherId ?? UNSET);
    }
  }, [open, currentMotherId, currentFatherId]);

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

  const mothers = allCats.filter((c) => c.gender === 'female' && c.id !== catId);
  const fathers = allCats.filter((c) => c.gender === 'male'   && c.id !== catId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const r = await fetch(`/api/cats/${catId}/lineage`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mother_id: motherId === UNSET ? null : motherId,
          father_id: fatherId === UNSET ? null : fatherId
        })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
      toast.success(t('parentsAssigned'));
      qc.invalidateQueries({ queryKey: ['lineage', catId] });
      // Any cat whose "offspring" list now includes this kitten needs to
      // refresh too. We don't know which cards are mounted, so invalidate
      // lineage globally — it's a cheap, scoped-to-current-user query.
      qc.invalidateQueries({ queryKey: ['lineage'] });
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
      title={t('assignParents')}
      description={t('assignParentsHint', { name: catName })}
    >
      <form onSubmit={onSubmit} className="space-y-4 py-2">
        {/* Mother */}
        <div className="space-y-1.5">
          <Label>{t('mother')}</Label>
          <Select value={motherId} onValueChange={setMotherId}>
            <SelectTrigger>
              <SelectValue placeholder={t('placeholders.selectFemale')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSET}>{t('noParentOption')}</SelectItem>
              {mothers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}{c.breed ? ` (${c.breed})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Father */}
        <div className="space-y-1.5">
          <Label>{t('father')}</Label>
          <Select value={fatherId} onValueChange={setFatherId}>
            <SelectTrigger>
              <SelectValue placeholder={t('placeholders.selectMale')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSET}>{t('noParentOption')}</SelectItem>
              {fathers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}{c.breed ? ` (${c.breed})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button type="submit" disabled={submitting}>{submitting ? tc('saving') : tc('save')}</Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
