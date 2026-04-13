'use client';

import { useEffect, useState } from 'react';
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

type Specialisation = 'general' | 'dermatology' | 'cardiology' | 'oncology' | 'dentistry' | 'surgery' | 'other';

interface DoctorRow {
  id: string;
  full_name: string;
  specialisation: Specialisation;
  phone?: string | null;
  notes?: string | null;
  is_active: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  clinicId: string;
  doctor?: DoctorRow;
}

export function DoctorModal({ open, onClose, clinicId, doctor }: Props) {
  const t  = useTranslations('vet');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName]   = useState('');
  const [spec, setSpec]           = useState<Specialisation>('general');
  const [phone, setPhone]         = useState('');
  const [notes, setNotes]         = useState('');
  const [isActive, setIsActive]   = useState(true);

  useEffect(() => {
    if (open) {
      setFullName(doctor?.full_name ?? '');
      setSpec(doctor?.specialisation ?? 'general');
      setPhone(doctor?.phone ?? '');
      setNotes(doctor?.notes ?? '');
      setIsActive(doctor?.is_active ?? true);
    }
  }, [open, doctor]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) { toast.error(t('errors.nameRequired')); return; }
    setSubmitting(true);
    try {
      const body = {
        full_name:      fullName.trim(),
        specialisation: spec,
        clinic_id:      clinicId,
        phone:          phone.trim() || null,
        notes:          notes.trim() || null,
        is_active:      isActive
      };
      const url  = doctor ? `/api/doctors/${doctor.id}` : '/api/doctors';
      const meth = doctor ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method: meth,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
      toast.success(doctor ? t('doctorUpdated') : t('doctorCreated'));
      qc.invalidateQueries({ queryKey: ['clinics'] });
      qc.invalidateQueries({ queryKey: ['doctors'] });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const SPECS: Specialisation[] = ['general', 'dermatology', 'cardiology', 'oncology', 'dentistry', 'surgery', 'other'];

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      title={doctor ? t('editDoctor') : t('newDoctor')}
    >
      <form onSubmit={onSubmit} className="space-y-4 py-2">
        <div className="space-y-1.5">
          <Label htmlFor="doc-name">{t('fields.fullName')}</Label>
          <Input id="doc-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="doc-spec">{t('fields.specialisation')}</Label>
          <Select value={spec} onValueChange={(v) => setSpec(v as Specialisation)}>
            <SelectTrigger id="doc-spec"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SPECS.map((s) => (
                <SelectItem key={s} value={s}>{t(`specialisations.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="doc-phone">{t('fields.phone')}</Label>
          <Input id="doc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="doc-notes">{tc('notes')}</Label>
          <Textarea id="doc-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="doc-active"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          <Label htmlFor="doc-active" className="cursor-pointer">{t('fields.isActive')}</Label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button type="submit" disabled={submitting}>{submitting ? tc('saving') : tc('save')}</Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
