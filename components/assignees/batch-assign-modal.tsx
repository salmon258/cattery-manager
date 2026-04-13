'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { AssigneeSelect } from '@/components/assignees/assignee-select';

interface Props {
  open: boolean;
  onClose: () => void;
  catIds: string[];
  /** Called with the updated count once the mutation succeeds. */
  onSuccess?: () => void;
}

export function BatchAssignModal({ open, onClose, catIds, onSuccess }: Props) {
  const t  = useTranslations('assignees');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const [value, setValue] = useState<string | null>(null);
  useEffect(() => { if (open) setValue(null); }, [open]);

  const m = useMutation({
    mutationFn: async (assignee_id: string | null) => {
      const r = await fetch('/api/cats/assign-batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cat_ids: catIds, assignee_id })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
      return (await r.json()).updated as number;
    },
    onSuccess: (updated) => {
      toast.success(t('batchUpdated', { count: updated }));
      qc.invalidateQueries({ queryKey: ['cats'] });
      qc.invalidateQueries({ queryKey: ['assignees'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      onSuccess?.();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t('batchAssignTitle')}
      description={t('batchAssignDesc', { count: catIds.length })}
    >
      <div className="space-y-3 py-2">
        <div className="space-y-2">
          <Label>{t('primaryAssignee')}</Label>
          <AssigneeSelect value={value} onChange={setValue} />
          <p className="text-xs text-muted-foreground">{t('batchAssignHint')}</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button onClick={() => m.mutate(value)} disabled={m.isPending}>
            {m.isPending ? tc('saving') : tc('save')}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
