'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { createTicketSchema, type CreateTicketInput } from '@/lib/schemas/health-tickets';
import { uploadImage } from '@/lib/storage/upload';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { PhotoPicker } from '@/components/health/photo-picker';

interface Props {
  open: boolean;
  onClose: () => void;
  catId: string;
  catName?: string;
}

export function OpenTicketModal({ open, onClose, catId, catName }: Props) {
  const t = useTranslations('healthTickets');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors }
  } = useForm<CreateTicketInput>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: { severity: 'low', photo_urls: [] }
  });

  function handleClose() {
    reset();
    setPhotos([]);
    onClose();
  }

  async function onSubmit(values: CreateTicketInput) {
    setSubmitting(true);
    try {
      // Upload photos first
      const photoUrls: string[] = [];
      for (const file of photos) {
        const { url } = await uploadImage('health-photos', file, `tickets/${catId}`);
        photoUrls.push(url);
      }

      const r = await fetch(`/api/cats/${catId}/health-tickets`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...values, photo_urls: photoUrls })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
      toast.success(t('created'));
      qc.invalidateQueries({ queryKey: ['health-tickets', catId] });
      qc.invalidateQueries({ queryKey: ['health-tickets-count'] });
      qc.invalidateQueries({ queryKey: ['me-cats'] });
      handleClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(v) => { if (!v) handleClose(); }}
      title={catName ? `${t('openTicket')} — ${catName}` : t('openTicket')}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
        <div className="space-y-1.5">
          <Label htmlFor="ht-title">{t('fields.title')}</Label>
          <Input
            id="ht-title"
            placeholder={t('fields.titlePlaceholder')}
            {...register('title')}
          />
          {errors.title && (
            <p className="text-xs text-destructive">{errors.title.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ht-severity">{t('fields.severity')}</Label>
          <Select
            defaultValue="low"
            onValueChange={(v) => setValue('severity', v as CreateTicketInput['severity'])}
          >
            <SelectTrigger id="ht-severity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['low', 'medium', 'high', 'critical'] as const).map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`severities.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ht-desc">{t('fields.description')}</Label>
          <Textarea
            id="ht-desc"
            rows={4}
            placeholder={t('fields.descriptionPlaceholder')}
            {...register('description')}
          />
          {errors.description && (
            <p className="text-xs text-destructive">{errors.description.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>{t('fields.photos')}</Label>
          <PhotoPicker files={photos} onChange={setPhotos} disabled={submitting} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            {tc('cancel')}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? tc('saving') : t('submitOpen')}
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
