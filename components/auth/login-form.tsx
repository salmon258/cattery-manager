'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { loginSchema, type LoginInput } from '@/lib/schemas/auth';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const redirect = search.get('redirect') || '/';
  const t = useTranslations('auth.login');
  const tc = useTranslations('common');
  const tv = useTranslations('validation');

  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error, data } = await supabase.auth.signInWithPassword(values);
      if (error) {
        toast.error(t('invalidCredentials'));
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', data.user!.id)
        .single();

      if (profile && profile.is_active === false) {
        await supabase.auth.signOut();
        toast.error(t('accountDisabled'));
        return;
      }

      // Stamp last_login_at (best effort)
      await supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', data.user!.id);

      router.push(redirect);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t('email')}</Label>
        <Input id="email" type="email" autoComplete="email" {...register('email')} />
        {errors.email && (
          <p className="text-xs text-destructive">
            {errors.email.message?.startsWith('validation.')
              ? tv(errors.email.message.replace('validation.', '') as 'required' | 'email')
              : errors.email.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t('password')}</Label>
        <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
        {errors.password && <p className="text-xs text-destructive">{tv('required')}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? t('submitting') : t('submit')}
      </Button>
      <p className="text-xs text-muted-foreground text-center">{tc('loading')}…? Contact your admin.</p>
    </form>
  );
}
