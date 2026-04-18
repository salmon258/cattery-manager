'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { WeightReport } from './sections/weight-report';
import { EatingReport } from './sections/eating-report';
import { MedicationComplianceReport } from './sections/medication-compliance-report';
import { VaccinationsReport } from './sections/vaccinations-report';
import { VetVisitsReport } from './sections/vet-visits-report';
import { HealthTicketsReport } from './sections/health-tickets-report';
import { HeatLogsReport } from './sections/heat-logs-report';
import { RoomMovementsReport } from './sections/room-movements-report';
import { ActivityReport } from './sections/activity-report';
import { SpendingReport } from './sections/spending-report';

type TabKey =
  | 'weight'
  | 'eating'
  | 'medication'
  | 'vaccinations'
  | 'vet'
  | 'tickets'
  | 'heat'
  | 'rooms'
  | 'activity'
  | 'spending';

export function ReportsClient() {
  const t = useTranslations('reports');
  const [tab, setTab] = useState<TabKey>('weight');

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'weight',       label: t('tabs.weight') },
    { key: 'eating',       label: t('tabs.eating') },
    { key: 'medication',   label: t('tabs.medication') },
    { key: 'vaccinations', label: t('tabs.vaccinations') },
    { key: 'vet',          label: t('tabs.vet') },
    { key: 'tickets',      label: t('tabs.tickets') },
    { key: 'heat',         label: t('tabs.heat') },
    { key: 'rooms',        label: t('tabs.rooms') },
    { key: 'activity',     label: t('tabs.activity') },
    { key: 'spending',     label: t('tabs.spending') }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
      </div>

      {/* Tabs */}
      <div className="border-b overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={cn(
                'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === item.key
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'weight'       && <WeightReport />}
      {tab === 'eating'       && <EatingReport />}
      {tab === 'medication'   && <MedicationComplianceReport />}
      {tab === 'vaccinations' && <VaccinationsReport />}
      {tab === 'vet'          && <VetVisitsReport />}
      {tab === 'tickets'      && <HealthTicketsReport />}
      {tab === 'heat'         && <HeatLogsReport />}
      {tab === 'rooms'        && <RoomMovementsReport />}
      {tab === 'activity'     && <ActivityReport />}
      {tab === 'spending'     && <SpendingReport />}
    </div>
  );
}
