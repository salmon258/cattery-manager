'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus, Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDate } from '@/lib/utils';
import { MatingRecordModal, type EditingMatingRecord } from './mating-record-modal';
import { UpdateStatusModal } from './update-status-modal';
import { LitterModal } from './litter-modal';

type MatingStatus = 'planned' | 'confirmed' | 'pregnant' | 'delivered' | 'failed';

type CatStub = {
  id: string;
  name: string;
  profile_photo_url: string | null;
  gender: 'male' | 'female';
};

type LitterRow = {
  id: string;
  birth_date: string;
  litter_size_born: number;
  litter_size_survived: number | null;
};

type MatingRecord = {
  id: string;
  mating_date: string;
  expected_labor_date: string;
  mating_method: 'natural' | 'ai';
  status: MatingStatus;
  notes: string | null;
  female_cat: CatStub;
  male_cat: CatStub;
  litters: LitterRow[];
};

function toEditingRecord(rec: MatingRecord): EditingMatingRecord {
  return {
    id:             rec.id,
    female_cat_id:  rec.female_cat.id,
    male_cat_id:    rec.male_cat.id,
    mating_date:    rec.mating_date,
    mating_method:  rec.mating_method,
    notes:          rec.notes
  };
}

function statusBadgeClass(s: MatingStatus) {
  return {
    planned:   'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    pregnant:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    delivered: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    failed:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  }[s] ?? '';
}

const STATUS_ORDER: MatingStatus[] = ['pregnant', 'confirmed', 'planned', 'delivered', 'failed'];

export function BreedingClient() {
  const t  = useTranslations('breeding');
  const tc = useTranslations('common');

  const [showNew, setShowNew]           = useState(false);
  const [statusRecord, setStatusRecord] = useState<MatingRecord | null>(null);
  const [litterRecord, setLitterRecord] = useState<MatingRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<MatingRecord | null>(null);
  const [showFailed, setShowFailed]     = useState(false);

  const { data: records = [], isLoading, error, refetch } = useQuery<MatingRecord[]>({
    queryKey: ['mating-records'],
    queryFn: async () => {
      const r = await fetch('/api/mating-records', { cache: 'no-store' });
      if (!r.ok) throw new Error('Failed');
      return (await r.json()).records;
    }
  });

  const active = records
    .filter((r) => r.status !== 'failed')
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

  const failed = records.filter((r) => r.status === 'failed');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> {t('newMating')}
        </Button>
      </div>

      {isLoading && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{tc('loading')}</CardContent></Card>
      )}
      {error && (
        <Card>
          <CardContent className="p-6 text-sm flex items-center justify-between">
            <span className="text-destructive">{tc('error')}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>{tc('retry')}</Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && active.length === 0 && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{t('noMatings')}</CardContent></Card>
      )}

      <div className="space-y-3">
        {active.map((rec) => (
          <Card key={rec.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                {/* Pair */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-8 w-8">
                      {rec.female_cat.profile_photo_url && (
                        <AvatarImage src={rec.female_cat.profile_photo_url} alt={rec.female_cat.name} />
                      )}
                      <AvatarFallback className="text-xs">{rec.female_cat.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <Link href={`/cats/${rec.female_cat.id}`} className="text-sm font-medium hover:underline">
                      <span className="text-pink-500">♀</span> {rec.female_cat.name}
                    </Link>
                  </div>
                  <span className="text-muted-foreground text-sm">×</span>
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-8 w-8">
                      {rec.male_cat.profile_photo_url && (
                        <AvatarImage src={rec.male_cat.profile_photo_url} alt={rec.male_cat.name} />
                      )}
                      <AvatarFallback className="text-xs">{rec.male_cat.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <Link href={`/cats/${rec.male_cat.id}`} className="text-sm font-medium hover:underline">
                      <span className="text-blue-500">♂</span> {rec.male_cat.name}
                    </Link>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass(rec.status)}`}>
                    {t(`statuses.${rec.status}`)}
                  </span>
                  {rec.status !== 'delivered' && rec.status !== 'failed' && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setStatusRecord(rec)}>
                      {t('updateStatus')}
                    </Button>
                  )}
                  {rec.status === 'delivered' && rec.litters.length === 0 && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setLitterRecord(rec)}>
                      {t('registerLitter')}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => setEditingRecord(rec)}
                    aria-label={t('editMating')}
                    title={t('editMating')}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>{t('fields.matingDate')}: <span className="text-foreground">{formatDate(rec.mating_date)}</span></span>
                <span>{t('methods.' + rec.mating_method)}</span>
                {rec.status !== 'delivered' && rec.status !== 'failed' && (
                  <span>
                    {t('fields.expectedLabor')}: <span className="text-foreground font-medium">{formatDate(rec.expected_labor_date)}</span>
                  </span>
                )}
              </div>

              {rec.litters.map((litter) => (
                <div key={litter.id} className="text-xs text-muted-foreground pl-3 border-l-2 border-emerald-400">
                  {t('litterBorn', {
                    date: formatDate(litter.birth_date),
                    born: litter.litter_size_born,
                    survived: litter.litter_size_survived ?? litter.litter_size_born
                  })}
                </div>
              ))}

              {rec.notes && (
                <p className="text-xs text-muted-foreground italic">{rec.notes}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Failed records collapsible */}
      {failed.length > 0 && (
        <div>
          <button
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            onClick={() => setShowFailed((v) => !v)}
          >
            {t('failedCount', { count: failed.length })}
          </button>
          {showFailed && (
            <div className="mt-2 space-y-3">
              {failed.map((rec) => (
                <Card key={rec.id} className="opacity-60">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Link href={`/cats/${rec.female_cat.id}`} className="text-sm hover:underline">
                        <span className="text-pink-500">♀</span> {rec.female_cat.name}
                      </Link>
                      <span className="text-muted-foreground">×</span>
                      <Link href={`/cats/${rec.male_cat.id}`} className="text-sm hover:underline">
                        <span className="text-blue-500">♂</span> {rec.male_cat.name}
                      </Link>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass('failed')}`}>
                        {t('statuses.failed')}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(rec.mating_date)}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 ml-auto"
                        onClick={() => setEditingRecord(rec)}
                        aria-label={t('editMating')}
                        title={t('editMating')}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <MatingRecordModal open={showNew} onClose={() => setShowNew(false)} />

      {editingRecord && (
        <MatingRecordModal
          open={!!editingRecord}
          onClose={() => setEditingRecord(null)}
          editing={toEditingRecord(editingRecord)}
        />
      )}

      {statusRecord && (
        <UpdateStatusModal
          open={!!statusRecord}
          onClose={() => setStatusRecord(null)}
          recordId={statusRecord.id}
          currentStatus={statusRecord.status}
          catId=""
        />
      )}

      {litterRecord && (
        <LitterModal
          open={!!litterRecord}
          onClose={() => setLitterRecord(null)}
          recordId={litterRecord.id}
          catId=""
          femaleName={litterRecord.female_cat.name}
          maleName={litterRecord.male_cat.name}
        />
      )}
    </div>
  );
}
