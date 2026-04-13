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

interface ClinicRow {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
  is_active: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  clinic: ClinicRow | null;
}

export function ClinicModal({ open, onClose, clinic }: Props) {
  const t  = useTranslations('vet');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const [submitting, setSubmitting] = useState(false);
  const [name, setName]       = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone]     = useState('');
  const [email, setEmail]     = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes]     = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open) {
      setName(clinic?.name ?? '');
      setAddress(clinic?.address ?? '');
      setPhone(clinic?.phone ?? '');
      setEmail(clinic?.email ?? '');
      setWebsite(clinic?.website ?? '');
      setNotes(clinic?.notes ?? '');
      setIsActive(clinic?.is_active ?? true);
    }
  }, [open, clinic]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error(t('errors.nameRequired')); return; }
    setSubmitting(true);
    try {
      const body = {
        name:    name.trim(),
        address: address.trim() || null,
        phone:   phone.trim() || null,
        email:   email.trim() || null,
        website: website.trim() || null,
        notes:   notes.trim() || null,
        is_active: isActive
      };
      const url  = clinic ? `/api/clinics/${clinic.id}` : '/api/clinics';
      const meth = clinic ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method: meth,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
      toast.success(clinic ? t('clinicUpdated') : t('clinicCreated'));
      qc.invalidateQueries({ queryKey: ['clinics'] });
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
      title={clinic ? t('editClinic') : t('newClinic')}
    >
      <form onSubmit={onSubmit} className="space-y-4 py-2">
        <div className="space-y-1.5">
          <Label htmlFor="clinic-name">{t('fields.name')}</Label>
          <Input id="clinic-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="clinic-address">{t('fields.address')}</Label>
          <Textarea id="clinic-address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="clinic-phone">{t('fields.phone')}</Label>
            <Input id="clinic-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clinic-email">{t('fields.email')}</Label>
            <Input id="clinic-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="clinic-website">{t('fields.website')}</Label>
          <Input id="clinic-website" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="clinic-notes">{tc('notes')}</Label>
          <Textarea id="clinic-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="clinic-active"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          <Label htmlFor="clinic-active" className="cursor-pointer">{t('fields.isActive')}</Label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button type="submit" disabled={submitting}>{submitting ? tc('saving') : tc('save')}</Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
