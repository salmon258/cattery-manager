'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

interface CatOption {
  id: string;
  name: string;
  breed: string | null;
  gender: 'male' | 'female';
}

type KittenDraft =
  | { kind: 'new';      name: string; gender: 'male' | 'female' }
  | { kind: 'existing'; cat_id: string };

interface Props {
  open: boolean;
  onClose: () => void;
  recordId: string;
  catId: string;
  femaleName: string;
  maleName: string;
  /** IDs of the two parents in this mating, so we can exclude them from the
   *  "attach existing cat" picker. Optional — when not supplied we fall back
   *  to just filtering by `catId`, which is the detail-page cat. */
  femaleCatId?: string;
  maleCatId?: string;
}

export function LitterModal({
  open, onClose, recordId, catId, femaleName, maleName, femaleCatId, maleCatId
}: Props) {
  const t  = useTranslations('breeding');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const today = new Date().toISOString().split('T')[0];
  const [submitting, setSubmitting] = useState(false);
  const [birthDate, setBirthDate]   = useState(today);
  const [born, setBorn]             = useState('');
  const [survived, setSurvived]     = useState('');
  const [notes, setNotes]           = useState('');
  const [kittens, setKittens]       = useState<KittenDraft[]>([]);

  // Cat list for the "existing" picker. We fetch all active cats and filter
  // out the two parents + any already-picked kittens below.
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

  function addNewKitten() {
    setKittens((k) => [...k, { kind: 'new', name: '', gender: 'male' }]);
  }
  function addExistingKitten() {
    setKittens((k) => [...k, { kind: 'existing', cat_id: '' }]);
  }
  function removeKitten(i: number) {
    setKittens((k) => k.filter((_, idx) => idx !== i));
  }
  function updateKitten(i: number, patch: Partial<KittenDraft>) {
    setKittens((k) => k.map((item, idx) => {
      if (idx !== i) return item;
      return { ...item, ...patch } as KittenDraft;
    }));
  }

  function resetForm() {
    setBirthDate(today); setBorn(''); setSurvived(''); setNotes(''); setKittens([]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const bornNum = parseInt(born, 10);
    if (isNaN(bornNum) || bornNum < 1) {
      toast.error(t('errors.litterSizeRequired'));
      return;
    }
    // Validate kitten entries
    for (const k of kittens) {
      if (k.kind === 'new' && !k.name.trim()) {
        toast.error(t('errors.kittenNameRequired'));
        return;
      }
      if (k.kind === 'existing' && !k.cat_id) {
        toast.error(t('errors.kittenCatRequired'));
        return;
      }
    }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/mating-records/${recordId}/litters`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          birth_date: birthDate,
          litter_size_born: bornNum,
          litter_size_survived: survived ? parseInt(survived, 10) : null,
          notes: notes || null,
          kittens: kittens.map((k) => k.kind === 'new'
            ? { kind: 'new', name: k.name.trim(), gender: k.gender }
            : { kind: 'existing', cat_id: k.cat_id }
          )
        })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
      toast.success(t('litterRegistered'));
      qc.invalidateQueries({ queryKey: ['mating-records', catId] });
      qc.invalidateQueries({ queryKey: ['mating-records'] });
      qc.invalidateQueries({ queryKey: ['lineage'] });
      qc.invalidateQueries({ queryKey: ['cats'] });
      resetForm();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // Build the list of cats eligible as "existing kitten". Exclude both
  // parents and any already-picked kitten.
  const pickedIds = new Set(
    kittens.filter((k) => k.kind === 'existing').map((k) => (k as Extract<KittenDraft, { kind: 'existing' }>).cat_id)
  );
  const pickableCats = allCats.filter((c) => {
    if (c.id === femaleCatId || c.id === maleCatId) return false;
    if (c.id === catId) return false;
    return true;
  });

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(v) => { if (!v) { resetForm(); onClose(); } }}
      title={t('registerLitter')}
      description={`${femaleName} × ${maleName}`}
    >
      <form onSubmit={onSubmit} className="space-y-4 py-2">
        <div className="space-y-1.5">
          <Label htmlFor="lm-date">{t('fields.birthDate')}</Label>
          <Input id="lm-date" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="lm-born">{t('fields.bornCount')}</Label>
            <Input id="lm-born" type="number" min={1} value={born} onChange={(e) => setBorn(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lm-survived">{t('fields.survivedCount')}</Label>
            <Input id="lm-survived" type="number" min={0} value={survived} onChange={(e) => setSurvived(e.target.value)} placeholder={tc('optional')} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lm-notes">{tc('notes')}</Label>
          <Textarea id="lm-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {/* Kittens */}
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label>{t('kittens')}</Label>
            <div className="flex gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={addNewKitten}>
                <Plus className="h-3 w-3" /> {t('addKitten')}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={addExistingKitten}>
                <Plus className="h-3 w-3" /> {t('attachExistingKitten')}
              </Button>
            </div>
          </div>
          {kittens.length === 0 && (
            <p className="text-xs text-muted-foreground">{t('kittensOptional')}</p>
          )}
          {kittens.map((kitten, i) => (
            <div key={i} className="flex items-center gap-2">
              {kitten.kind === 'new' ? (
                <>
                  <Input
                    placeholder={t('fields.kittenName')}
                    value={kitten.name}
                    onChange={(e) => updateKitten(i, { name: e.target.value })}
                    className="flex-1"
                  />
                  <Select
                    value={kitten.gender}
                    onValueChange={(v) => updateKitten(i, { gender: v as 'male' | 'female' })}
                  >
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">♂ {t('male')}</SelectItem>
                      <SelectItem value="female">♀ {t('female')}</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              ) : (
                <Select
                  value={kitten.cat_id}
                  onValueChange={(v) => updateKitten(i, { cat_id: v })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t('selectExistingCat')} />
                  </SelectTrigger>
                  <SelectContent>
                    {pickableCats.map((c) => {
                      // Disable cats already picked in another row (other than this one).
                      const disabled = pickedIds.has(c.id) && c.id !== kitten.cat_id;
                      return (
                        <SelectItem key={c.id} value={c.id} disabled={disabled}>
                          {c.gender === 'male' ? '♂' : '♀'} {c.name}{c.breed ? ` (${c.breed})` : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
              <Button type="button" variant="ghost" size="icon" onClick={() => removeKitten(i)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => { resetForm(); onClose(); }}>{tc('cancel')}</Button>
          <Button type="submit" disabled={submitting}>{submitting ? tc('saving') : tc('save')}</Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
