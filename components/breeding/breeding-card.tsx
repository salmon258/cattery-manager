'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Trash2, ChevronDown, ChevronUp, Pencil } from 'lucide-react';

import type { UserRole } from '@/lib/supabase/aliases';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDate } from '@/lib/utils';
import { MatingRecordModal, type EditingMatingRecord } from './mating-record-modal';
import { UpdateStatusModal } from './update-status-modal';
import { LitterModal } from './litter-modal';
import { HeatLogModal } from './heat-log-modal';
import { AssignParentsModal } from './assign-parents-modal';

// ─── Types ────────────────────────────────────────────────────────────────────
type MatingStatus = 'planned' | 'confirmed' | 'pregnant' | 'delivered' | 'failed';

type CatStub = {
  id: string;
  name: string;
  profile_photo_url: string | null;
  gender: 'male' | 'female';
  breed: string | null;
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

type HeatLog = {
  id: string;
  observed_date: string;
  intensity: 'mild' | 'moderate' | 'strong';
  notes: string | null;
  logger: { id: string; full_name: string } | null;
};

type LineageData = {
  parents: { mother: CatStub | null; father: CatStub | null } | null;
  litter_siblings: CatStub[];
  offspring: { litter_id: string; kittens: CatStub[] }[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function statusBadgeClass(s: MatingStatus) {
  return {
    planned:   'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    pregnant:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    delivered: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    failed:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  }[s] ?? '';
}

function intensityClass(i: string) {
  return {
    mild:     'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300',
    moderate: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    strong:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  }[i] ?? '';
}

function CatChip({ cat }: { cat: CatStub }) {
  return (
    <Link href={`/cats/${cat.id}`} className="flex items-center gap-1.5 hover:underline">
      <Avatar className="h-6 w-6">
        {cat.profile_photo_url && <AvatarImage src={cat.profile_photo_url} alt={cat.name} />}
        <AvatarFallback className="text-[10px]">{cat.name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="text-sm">{cat.name}</span>
    </Link>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props {
  catId: string;
  catName: string;
  catGender: 'male' | 'female';
  role: UserRole;
}

export function BreedingCard({ catId, catName, catGender, role }: Props) {
  const t  = useTranslations('breeding');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const isAdmin = role === 'admin';

  const [showNewMating, setShowNewMating]       = useState(false);
  const [showHeatLog, setShowHeatLog]           = useState(false);
  const [statusRecord, setStatusRecord]         = useState<MatingRecord | null>(null);
  const [litterRecord, setLitterRecord]         = useState<MatingRecord | null>(null);
  const [editingRecord, setEditingRecord]       = useState<MatingRecord | null>(null);
  const [showAssignParents, setShowAssignParents] = useState(false);
  const [showAllHeat, setShowAllHeat]           = useState(false);

  // ── Mating records ──────────────────────────────────────────────────────────
  const { data: records = [], isLoading: recordsLoading } = useQuery<MatingRecord[]>({
    queryKey: ['mating-records', catId],
    queryFn: async () => {
      const r = await fetch(`/api/mating-records?cat_id=${catId}`, { cache: 'no-store' });
      if (!r.ok) return [];
      return (await r.json()).records;
    }
  });

  // ── Heat logs (female only) ────────────────────────────────────────────────
  const { data: heatLogs = [], isLoading: heatLoading } = useQuery<HeatLog[]>({
    queryKey: ['heat-logs', catId],
    queryFn: async () => {
      const r = await fetch(`/api/cats/${catId}/heat-logs`, { cache: 'no-store' });
      if (!r.ok) return [];
      return (await r.json()).logs;
    },
    enabled: catGender === 'female'
  });

  // ── Lineage ─────────────────────────────────────────────────────────────────
  const { data: lineage } = useQuery<LineageData>({
    queryKey: ['lineage', catId],
    queryFn: async () => {
      const r = await fetch(`/api/cats/${catId}/lineage`, { cache: 'no-store' });
      if (!r.ok) return { parents: null, litter_siblings: [], offspring: [] };
      return r.json();
    }
  });

  // ── Delete heat log (admin) ─────────────────────────────────────────────────
  const deleteHeatLog = useMutation({
    mutationFn: async (logId: string) => {
      const r = await fetch(`/api/heat-logs/${logId}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['heat-logs', catId] });
      toast.success(t('heatDeleted'));
    },
    onError: () => toast.error(tc('error'))
  });

  const visibleHeatLogs = showAllHeat ? heatLogs : heatLogs.slice(0, 3);
  const activeRecords = records.filter((r) => r.status !== 'failed');
  const failedRecords = records.filter((r) => r.status === 'failed');

  return (
    <>
      <Card className="md:col-span-2">
        <CardHeader className="flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">{t('title')}</CardTitle>
          <div className="flex gap-2 flex-wrap">
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setShowNewMating(true)}>
                <Plus className="h-4 w-4" /> {t('newMating')}
              </Button>
            )}
            {catGender === 'female' && (
              <Button size="sm" variant="outline" onClick={() => setShowHeatLog(true)}>
                <Plus className="h-4 w-4" /> {t('logHeat')}
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ─── Lineage ─────────────────────────────────────────────────── */}
          {(lineage?.parents || (lineage?.litter_siblings ?? []).length > 0 || isAdmin) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="text-sm font-medium text-muted-foreground">{t('lineage')}</h4>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs px-2"
                    onClick={() => setShowAssignParents(true)}
                  >
                    <Pencil className="h-3 w-3" />
                    {lineage?.parents?.mother || lineage?.parents?.father
                      ? t('editParents')
                      : t('assignParents')}
                  </Button>
                )}
              </div>
              {lineage?.parents && (lineage.parents.mother || lineage.parents.father) ? (
                <div className="flex flex-wrap gap-4 text-sm">
                  {lineage.parents.mother && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground text-xs">{t('mother')}:</span>
                      <CatChip cat={lineage.parents.mother} />
                    </div>
                  )}
                  {lineage.parents.father && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground text-xs">{t('father')}:</span>
                      <CatChip cat={lineage.parents.father} />
                    </div>
                  )}
                </div>
              ) : (
                isAdmin && (
                  <p className="text-xs text-muted-foreground">{t('noParents')}</p>
                )
              )}
              {(lineage?.litter_siblings ?? []).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-muted-foreground text-xs self-center">{t('siblings')}:</span>
                  {lineage!.litter_siblings.map((s) => <CatChip key={s.id} cat={s} />)}
                </div>
              )}
            </div>
          )}

          {/* ─── Mating records ──────────────────────────────────────────── */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">{t('matings')}</h4>
            {recordsLoading && <p className="text-sm text-muted-foreground">{tc('loading')}</p>}
            {!recordsLoading && records.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('noMatings')}</p>
            )}
            {activeRecords.map((rec) => (
              <MatingRow
                key={rec.id}
                rec={rec}
                catId={catId}
                catGender={catGender}
                isAdmin={isAdmin}
                t={t}
                tc={tc}
                onUpdateStatus={() => setStatusRecord(rec)}
                onRegisterLitter={() => setLitterRecord(rec)}
                onEdit={() => setEditingRecord(rec)}
              />
            ))}
            {failedRecords.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground select-none">
                  {t('failedCount', { count: failedRecords.length })}
                </summary>
                <div className="mt-2 space-y-2">
                  {failedRecords.map((rec) => (
                    <MatingRow
                      key={rec.id}
                      rec={rec}
                      catId={catId}
                      catGender={catGender}
                      isAdmin={isAdmin}
                      t={t}
                      tc={tc}
                      onUpdateStatus={() => setStatusRecord(rec)}
                      onRegisterLitter={() => setLitterRecord(rec)}
                      onEdit={() => setEditingRecord(rec)}
                    />
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* ─── Offspring summary ──────────────────────────────────────── */}
          {(lineage?.offspring ?? []).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">{t('offspring')}</h4>
              {lineage!.offspring.map((litter) => (
                <div key={litter.litter_id} className="flex flex-wrap gap-2">
                  {(litter.kittens as CatStub[]).map((k) => (
                    <CatChip key={k.id} cat={k} />
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* ─── Heat logs (female only) ─────────────────────────────────── */}
          {catGender === 'female' && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">{t('heatHistory')}</h4>
              {heatLoading && <p className="text-sm text-muted-foreground">{tc('loading')}</p>}
              {!heatLoading && heatLogs.length === 0 && (
                <p className="text-sm text-muted-foreground">{t('noHeatLogs')}</p>
              )}
              <div className="space-y-1">
                {visibleHeatLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground w-24 shrink-0">{formatDate(log.observed_date)}</span>
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${intensityClass(log.intensity)}`}>
                      {t(`intensities.${log.intensity}`)}
                    </span>
                    {log.notes && (
                      <span className="text-muted-foreground truncate flex-1 text-xs">{log.notes}</span>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => deleteHeatLog.mutate(log.id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {heatLogs.length > 3 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowAllHeat((v) => !v)}
                >
                  {showAllHeat
                    ? <><ChevronUp className="h-3 w-3" /> {tc('showLess')}</>
                    : <><ChevronDown className="h-3 w-3" /> {tc('showMore', { count: heatLogs.length - 3 })}</>
                  }
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <MatingRecordModal
        open={showNewMating}
        onClose={() => setShowNewMating(false)}
        prefilledCat={{ id: catId, name: catName, gender: catGender }}
      />

      {editingRecord && (
        <MatingRecordModal
          open={!!editingRecord}
          onClose={() => setEditingRecord(null)}
          editing={toEditingRecord(editingRecord)}
        />
      )}

      <HeatLogModal
        open={showHeatLog}
        onClose={() => setShowHeatLog(false)}
        catId={catId}
        catName={catName}
      />

      {statusRecord && (
        <UpdateStatusModal
          open={!!statusRecord}
          onClose={() => setStatusRecord(null)}
          recordId={statusRecord.id}
          currentStatus={statusRecord.status}
          catId={catId}
        />
      )}

      {litterRecord && (
        <LitterModal
          open={!!litterRecord}
          onClose={() => setLitterRecord(null)}
          recordId={litterRecord.id}
          catId={catId}
          femaleName={litterRecord.female_cat.name}
          maleName={litterRecord.male_cat.name}
        />
      )}

      <AssignParentsModal
        open={showAssignParents}
        onClose={() => setShowAssignParents(false)}
        catId={catId}
        catName={catName}
        currentMotherId={lineage?.parents?.mother?.id ?? null}
        currentFatherId={lineage?.parents?.father?.id ?? null}
      />
    </>
  );
}

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

// ─── Mating row sub-component ─────────────────────────────────────────────────
function MatingRow({
  rec, catId, catGender, isAdmin, t, tc, onUpdateStatus, onRegisterLitter, onEdit
}: {
  rec: MatingRecord;
  catId: string;
  catGender: 'male' | 'female';
  isAdmin: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tc: any;
  onUpdateStatus: () => void;
  onRegisterLitter: () => void;
  onEdit: () => void;
}) {
  const partner = catGender === 'female' ? rec.male_cat : rec.female_cat;

  return (
    <div className="rounded-lg border p-3 space-y-2 text-sm">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CatChip cat={partner} />
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusBadgeClass(rec.status)}`}>
            {t(`statuses.${rec.status}`)}
          </span>
          <span className="text-muted-foreground text-xs">
            {t(`methods.${rec.mating_method}`)}
          </span>
        </div>
        {isAdmin && (
          <div className="flex gap-1.5 flex-wrap">
            {rec.status !== 'failed' && rec.status !== 'delivered' && (
              <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={onUpdateStatus}>
                {t('updateStatus')}
              </Button>
            )}
            {rec.status === 'delivered' && rec.litters.length === 0 && (
              <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={onRegisterLitter}>
                {t('registerLitter')}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={onEdit}
              aria-label={t('editMating')}
              title={t('editMating')}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>{t('fields.matingDate')}: <span className="text-foreground">{formatDate(rec.mating_date)}</span></span>
        {rec.status !== 'failed' && rec.status !== 'delivered' && (
          <span>{t('fields.expectedLabor')}: <span className="text-foreground">{formatDate(rec.expected_labor_date)}</span></span>
        )}
      </div>

      {rec.litters.map((litter) => (
        <div key={litter.id} className="text-xs text-muted-foreground pl-2 border-l-2 border-emerald-300">
          {t('litterBorn', {
            date: formatDate(litter.birth_date),
            born: litter.litter_size_born,
            survived: litter.litter_size_survived ?? litter.litter_size_born
          })}
        </div>
      ))}
    </div>
  );
}
