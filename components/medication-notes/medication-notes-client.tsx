'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BookOpen, Pill } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { SicknessesPanel } from './sicknesses-panel';
import { TemplatesPanel } from './templates-panel';

type Tab = 'sicknesses' | 'templates';

export function MedicationNotesClient() {
  const t = useTranslations('medicationNotes');
  const [tab, setTab] = useState<Tab>('sicknesses');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="inline-flex rounded-md border bg-background p-1 text-sm">
        <TabButton active={tab === 'sicknesses'} onClick={() => setTab('sicknesses')}>
          <BookOpen className="h-4 w-4" />
          {t('tabs.sicknesses')}
        </TabButton>
        <TabButton active={tab === 'templates'} onClick={() => setTab('templates')}>
          <Pill className="h-4 w-4" />
          {t('tabs.templates')}
        </TabButton>
      </div>

      {tab === 'sicknesses' ? <SicknessesPanel /> : <TemplatesPanel />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        'gap-2',
        active && 'bg-accent text-accent-foreground'
      )}
    >
      {children}
    </Button>
  );
}
