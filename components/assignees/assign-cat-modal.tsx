'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { AssigneeSelect } from '@/components/assignees/assignee-select';

interface Props {
  open: boolean;
  onClose: () => void;
  catId: string;
  currentAssigneeId: string | null;
}

export function AssignCatModal({ open, onClose, catId, currentAssigneeId }: Props) {
  const t = useTranslations('assignees');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const router = useRouter();

  const [value, setValue] = useState<string | null>(currentAssigneeId);
  useEffect(() => {
    if (open) setValue(currentAssigneeId);
  }, [open, currentAssigneeId]);

  const m = useMutation({
    mutationFn: async (assignee_id: string | null) => {
      const r = await fetch(`/api/cats/${catId}/assign`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assignee_id })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('updated'));
      qc.invalidateQueries({ queryKey: ['cats'] });
      qc.invalidateQueries({ queryKey: ['cat', catId] });
      qc.invalidateQueries({ queryKey: ['assignees'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
      router.refresh();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !o && onClose()} title={t('changeTitle')}>
      <div className="space-y-3 py-2">
        <div className="space-y-2">
          <Label>{t('primaryAssignee')}</Label>
          <AssigneeSelect value={value} onChange={setValue} />
          <p className="text-xs text-muted-foreground">{t('changeHint')}</p>
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
