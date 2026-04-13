'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Cat, KeyRound, Plus, UserCog } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ReassignOnDeactivateModal } from '@/components/assignees/reassign-on-deactivate-modal';
import { formatDate } from '@/lib/utils';

type UserRow = {
  id: string;
  full_name: string;
  role: 'admin' | 'cat_sitter';
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  email: string | null;
  assigned_cats_count: number;
};

async function fetchUsers(): Promise<UserRow[]> {
  const r = await fetch('/api/users', { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).users;
}

export function UsersClient() {
  const t = useTranslations('users');
  const tc = useTranslations('common');
  const tr = useTranslations('users.roles');
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [pwTarget, setPwTarget] = useState<UserRow | null>(null);
  const [reassignTarget, setReassignTarget] = useState<UserRow | null>(null);

  const { data: users = [], isLoading, error, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers
  });

  const toggleActive = useMutation({
    mutationFn: async (u: UserRow) => {
      const r = await fetch(`/api/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ is_active: !u.is_active })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: (_, u) => {
      toast.success(u.is_active ? t('deactivated') : t('reactivated'));
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['cats'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  function handleToggleActive(u: UserRow) {
    // Deactivating a sitter with assigned cats → open reassign modal.
    if (u.is_active && u.assigned_cats_count > 0) {
      setReassignTarget(u);
      return;
    }
    toggleActive.mutate(u);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> {t('new')}</Button>
      </div>

      {isLoading && <Card><CardContent className="p-6 text-sm text-muted-foreground">{tc('loading')}</CardContent></Card>}
      {error && (
        <Card>
          <CardContent className="p-6 text-sm flex items-center justify-between">
            <span className="text-destructive">{tc('error')}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>{tc('retry')}</Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && (
        <div className="grid gap-3">
          {users.map((u) => (
            <Card key={u.id}>
              <CardContent className="p-4 flex flex-wrap items-center gap-3 justify-between">
                <div className="min-w-0">
                  <div className="font-medium flex items-center gap-2 flex-wrap">
                    {u.full_name}
                    {!u.is_active && <Badge variant="destructive">inactive</Badge>}
                    <Badge variant="secondary">{tr(u.role)}</Badge>
                    {u.role === 'cat_sitter' && u.assigned_cats_count > 0 && (
                      <Badge variant="outline" className="gap-1">
                        <Cat className="h-3 w-3" /> {u.assigned_cats_count}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{u.email ?? '—'}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('fields.lastLogin')}: {formatDate(u.last_login_at)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(u)}>
                    <UserCog className="h-4 w-4" /> {tc('edit')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPwTarget(u)}>
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={u.is_active ? 'destructive' : 'secondary'}
                    size="sm"
                    disabled={toggleActive.isPending}
                    onClick={() => handleToggleActive(u)}
                  >
                    {u.is_active ? t('actions.deactivate') : t('actions.reactivate')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {users.length === 0 && (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">{tc('empty')}</CardContent></Card>
          )}
        </div>
      )}

      <CreateUserSheet open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditUserSheet user={editing} onClose={() => setEditing(null)} />
      <ResetPasswordSheet user={pwTarget} onClose={() => setPwTarget(null)} />
      <ReassignOnDeactivateModal
        open={!!reassignTarget}
        onClose={() => setReassignTarget(null)}
        userId={reassignTarget?.id ?? null}
        userName={reassignTarget?.full_name ?? ''}
        assignedCount={reassignTarget?.assigned_cats_count ?? 0}
      />
    </div>
  );
}

/* ----------------------------- modals ----------------------------- */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createUserSchema, type CreateUserInput, updateUserSchema, type UpdateUserInput, resetPasswordSchema, type ResetPasswordInput } from '@/lib/schemas/users';

function CreateUserSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('users');
  const tc = useTranslations('common');
  const tr = useTranslations('users.roles');
  const qc = useQueryClient();

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { full_name: '', email: '', password: '', role: 'cat_sitter' }
  });

  const m = useMutation({
    mutationFn: async (v: CreateUserInput) => {
      const r = await fetch('/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(v)
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('created'));
      qc.invalidateQueries({ queryKey: ['users'] });
      form.reset();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const errors = form.formState.errors;

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !o && onClose()} title={t('new')}>
      <form onSubmit={form.handleSubmit((v) => m.mutate(v))} className="space-y-3 py-2">
        <Field label={t('fields.fullName')} error={errors.full_name?.message}>
          <Input {...form.register('full_name')} />
        </Field>
        <Field label={t('fields.email')} error={errors.email?.message}>
          <Input type="email" {...form.register('email')} />
        </Field>
        <Field label={t('fields.tempPassword')} error={errors.password?.message}>
          <Input type="text" autoComplete="new-password" {...form.register('password')} />
        </Field>
        <Field label={t('fields.role')} error={errors.role?.message}>
          <Select value={form.watch('role')} onValueChange={(v) => form.setValue('role', v as 'admin' | 'cat_sitter')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">{tr('admin')}</SelectItem>
              <SelectItem value="cat_sitter">{tr('cat_sitter')}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button type="submit" disabled={m.isPending}>{m.isPending ? tc('saving') : tc('create')}</Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}

function Field({
  label,
  error,
  children
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function EditUserSheet({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const t = useTranslations('users');
  const tc = useTranslations('common');
  const tr = useTranslations('users.roles');
  const qc = useQueryClient();

  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    values: user ? { full_name: user.full_name, role: user.role, is_active: user.is_active } : undefined
  });

  const m = useMutation({
    mutationFn: async (v: UpdateUserInput) => {
      if (!user) return;
      const r = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(v)
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('updated'));
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const errors = form.formState.errors;

  return (
    <ResponsiveModal open={!!user} onOpenChange={(o) => !o && onClose()} title={tc('edit')}>
      <form onSubmit={form.handleSubmit((v) => m.mutate(v))} className="space-y-3 py-2">
        <Field label={t('fields.fullName')} error={errors.full_name?.message}>
          <Input {...form.register('full_name')} />
        </Field>
        <Field label={t('fields.role')} error={errors.role?.message}>
          <Select value={form.watch('role') ?? 'cat_sitter'} onValueChange={(v) => form.setValue('role', v as 'admin' | 'cat_sitter')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">{tr('admin')}</SelectItem>
              <SelectItem value="cat_sitter">{tr('cat_sitter')}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button type="submit" disabled={m.isPending}>{m.isPending ? tc('saving') : tc('save')}</Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}

function ResetPasswordSheet({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const t = useTranslations('users');
  const tc = useTranslations('common');
  const form = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: '' } });

  const m = useMutation({
    mutationFn: async (v: ResetPasswordInput) => {
      if (!user) return;
      const r = await fetch(`/api/users/${user.id}/password`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(v)
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success('Password updated');
      form.reset();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  return (
    <ResponsiveModal open={!!user} onOpenChange={(o) => !o && onClose()} title={t('actions.resetPassword')}>
      <form onSubmit={form.handleSubmit((v) => m.mutate(v))} className="space-y-3 py-2">
        <Field label={t('fields.tempPassword')} error={form.formState.errors.password?.message}>
          <Input type="text" autoComplete="new-password" {...form.register('password')} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button type="submit" disabled={m.isPending}>{m.isPending ? tc('saving') : tc('confirm')}</Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
