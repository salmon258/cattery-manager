'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { AssigneeSelect } from '@/components/assignees/assignee-select';

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  userName: string;
  assignedCount: number;
}

export function ReassignOnDeactivateModal({
  open,
  onClose,
  userId,
  userName,
  assignedCount
}: Props) {
  const t = useTranslations('assignees');
  const tu = useTranslations('users');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const [value, setValue] = useState<string | null>(null);
  useEffect(() => {
    if (open) setValue(null);
  }, [open]);

  const m = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const r = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ is_active: false, reassign_to: value })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(tu('deactivated'));
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['cats'] });
      qc.invalidateQueries({ queryKey: ['assignees'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t('reassignTitle')}
    >
      <div className="space-y-4 py-2">
        <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <div className="font-medium">{t('reassignWarning', { name: userName, count: assignedCount })}</div>
            <p className="mt-1 text-xs text-muted-foreground">{t('reassignExplanation')}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('reassignTo')}</Label>
          <AssigneeSelect value={value} onChange={setValue} excludeId={userId} />
          <p className="text-xs text-muted-foreground">{t('reassignHint')}</p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button variant="destructive" onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? tc('saving') : tu('actions.deactivate')}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
