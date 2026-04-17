'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronLeft } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Props {
  catId: string;
  catName: string;
  profilePhotoUrl: string | null;
  subtitle: string;
}

export function CatDetailHeader({ catId, catName, profilePhotoUrl, subtitle }: Props) {
  const tc = useTranslations('common');
  return (
    <div className="flex items-center gap-3">
      <Link
        href={`/cats/${catId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        aria-label={tc('back')}
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>
      <Avatar className="h-10 w-10">
        {profilePhotoUrl ? <AvatarImage src={profilePhotoUrl} alt={catName} /> : null}
        <AvatarFallback>{catName.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div>
        <div className="text-xs text-muted-foreground">
          <Link href={`/cats/${catId}`} className="hover:underline">
            {catName}
          </Link>
        </div>
        <h1 className="text-xl font-semibold leading-tight">{subtitle}</h1>
      </div>
    </div>
  );
}
