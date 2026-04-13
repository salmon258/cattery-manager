'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Laptop, LogOut, Moon, Sun, User, Globe } from 'lucide-react';
import { useTheme } from 'next-themes';

import type { Profile } from '@/lib/supabase/aliases';
import { createClient } from '@/lib/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function UserMenu({ profile }: { profile: Profile }) {
  const t = useTranslations('nav');
  const tt = useTranslations('theme');
  const tl = useTranslations('language');
  const { setTheme } = useTheme();
  const router = useRouter();

  async function setLanguage(lang: 'en' | 'id') {
    document.cookie = `NEXT_LOCALE=${lang}; path=/; max-age=31536000`;
    // Persist in profile best-effort
    const supabase = createClient();
    await supabase.from('profiles').update({ preferred_language: lang }).eq('id', profile.id);
    router.refresh();
  }

  async function setThemePref(pref: 'light' | 'dark' | 'system') {
    setTheme(pref);
    const supabase = createClient();
    await supabase.from('profiles').update({ theme_preference: pref }).eq('id', profile.id);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar className="h-8 w-8">
            {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt={profile.full_name} /> : null}
            <AvatarFallback>{initials(profile.full_name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span>{profile.full_name}</span>
          <span className="text-xs font-normal text-muted-foreground capitalize">{profile.role.replace('_', ' ')}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-2"><Sun className="h-3 w-3" /> {t('theme')}</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setThemePref('light')}><Sun className="h-4 w-4" /> {tt('light')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setThemePref('dark')}><Moon className="h-4 w-4" /> {tt('dark')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setThemePref('system')}><Laptop className="h-4 w-4" /> {tt('system')}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-2"><Globe className="h-3 w-3" /> {t('language')}</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setLanguage('en')}>{tl('en')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLanguage('id')}>{tl('id')}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action="/auth/signout" method="post">
          <button type="submit" className="w-full">
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} asChild>
              <span className="cursor-pointer w-full"><LogOut className="h-4 w-4" /> {t('logout')}</span>
            </DropdownMenuItem>
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
