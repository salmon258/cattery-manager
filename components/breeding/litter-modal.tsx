'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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

interface KittenInput { name: string; gender: 'male' | 'female' }

interface Props {
  open: boolean;
  onClose: () => void;
  recordId: string;
  catId: string;
  femaleName: string;
  maleName: string;
}

export function LitterModal({ open, onClose, recordId, catId, femaleName, maleName }: Props) {
  const t  = useTranslations('breeding');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const today = new Date().toISOString().split('T')[0];
  const [submitting, setSubmitting]   = useState(false);
  const [birthDate, setBirthDate]     = useState(today);
  const [born, setBorn]               = useState('');
  const [survived, setSurvived]       = useState('');
  const [notes, setNotes]             = useState('');
  const [kittens, setKittens]         = useState<KittenInput[]>([]);

  function addKitten() {
    setKittens((k) => [...k, { name: '', gender: 'male' }]);
  }
  function removeKitten(i: number) {
    setKittens((k) => k.filter((_, idx) => idx !== i));
  }
  function updateKitten(i: number, field: keyof KittenInput, value: string) {
    setKittens((k) => k.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
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
    // All named kittens must have a name
    if (kittens.some((k) => !k.name.trim())) {
      toast.error(t('errors.kittenNameRequired'));
      return;
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
          kittens: kittens.map((k) => ({ name: k.name.trim(), gender: k.gender }))
        })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
      toast.success(t('litterRegistered'));
      qc.invalidateQueries({ queryKey: ['mating-records', catId] });
      qc.invalidateQueries({ queryKey: ['mating-records'] });
      qc.invalidateQueries({ queryKey: ['cats'] });
      resetForm();
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
          <div className="flex items-center justify-between">
            <Label>{t('kittens')}</Label>
            <Button type="button" variant="outline" size="sm" onClick={addKitten}>
              <Plus className="h-3 w-3" /> {t('addKitten')}
            </Button>
          </div>
          {kittens.length === 0 && (
            <p className="text-xs text-muted-foreground">{t('kittensOptional')}</p>
          )}
          {kittens.map((kitten, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder={t('fields.kittenName')}
                value={kitten.name}
                onChange={(e) => updateKitten(i, 'name', e.target.value)}
                className="flex-1"
              />
              <Select value={kitten.gender} onValueChange={(v) => updateKitten(i, 'gender', v)}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">♂ {t('male')}</SelectItem>
                  <SelectItem value="female">♀ {t('female')}</SelectItem>
                </SelectContent>
              </Select>
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
