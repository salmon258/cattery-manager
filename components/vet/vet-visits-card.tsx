'use client';

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Stethoscope, Paperclip, Trash2, FileText, Image as ImageIcon, AlertCircle } from 'lucide-react';

import type { UserRole } from '@/lib/supabase/aliases';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate, cn } from '@/lib/utils';
import { VetVisitModal } from './vet-visit-modal';

type VisitType   = 'routine_checkup' | 'emergency' | 'follow_up' | 'vaccination' | 'surgery' | 'dental' | 'other';
type VisitStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

type MedicineRow = {
  id: string;
  medicine_name: string;
  dose: string | null;
  frequency: string | null;
  duration: string | null;
  notes: string | null;
};

type LabResultRow = {
  id: string;
  file_url: string;
  file_name: string;
  file_type: 'pdf' | 'image';
  kind: 'lab_result' | 'receipt';
  notes: string | null;
  uploaded_at: string;
};

type VisitRow = {
  id: string;
  visit_date: string;
  visit_type: VisitType;
  status: VisitStatus;
  chief_complaint: string | null;
  diagnosis: string | null;
  treatment_performed: string | null;
  follow_up_date: string | null;
  visit_cost: number | null;
  transport_cost: number | null;
  notes: string | null;
  clinic:  { id: string; name: string } | null;
  doctor:  { id: string; full_name: string; specialisation: string } | null;
  health_ticket: { id: string; title: string; status: string } | null;
  medicines: MedicineRow[];
  lab_results: LabResultRow[];
};

function typeClass(t: VisitType) {
  return {
    routine_checkup: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    emergency:       'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    follow_up:       'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    vaccination:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    surgery:         'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    dental:          'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    other:           'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
  }[t] ?? '';
}

interface Props {
  catId: string;
  catName: string;
  role: UserRole;
}

export function VetVisitsCard({ catId, catName, role }: Props) {
  const t  = useTranslations('vet');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const isAdmin = role === 'admin';

  const [modalOpen, setModalOpen]   = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: visits = [], isLoading } = useQuery<VisitRow[]>({
    queryKey: ['vet-visits', catId],
    queryFn: async () => {
      const r = await fetch(`/api/cats/${catId}/vet-visits`, { cache: 'no-store' });
      if (!r.ok) return [];
      return (await r.json()).visits;
    }
  });

  const deleteVisit = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/vet-visits/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vet-visits', catId] });
      toast.success(t('visitDeleted'));
    },
    onError: () => toast.error(tc('error'))
  });

  // Overdue follow-ups: follow_up_date in the past and no follow-up visit logged after it
  const today = new Date().toISOString().split('T')[0];
  const overdueFollowUps = visits.filter((v) =>
    v.follow_up_date && v.follow_up_date < today
    && !visits.some((v2) => v2.visit_type === 'follow_up' && v2.visit_date >= v.follow_up_date!)
  );

  return (
    <>
      <Card className="md:col-span-2">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-muted-foreground" />
            {t('vetHistory')}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> {t('newVisit')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">{tc('loading')}</p>}
          {!isLoading && visits.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('noVisits')}</p>
          )}

          {overdueFollowUps.length > 0 && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2 text-xs text-red-700 dark:text-red-300 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              {t('overdueFollowUps', { count: overdueFollowUps.length })}
            </div>
          )}

          <ul className="space-y-2">
            {visits.map((v) => {
              const expanded = expandedId === v.id;
              const labFiles     = v.lab_results.filter((r) => r.kind !== 'receipt');
              const receiptFiles = v.lab_results.filter((r) => r.kind === 'receipt');
              const labCount = labFiles.length;
              const recCount = receiptFiles.length;
              const medCount = v.medicines.length;
              const overdue  = overdueFollowUps.some((o) => o.id === v.id);

              return (
                <li key={v.id} className="rounded-md border">
                  <button
                    type="button"
                    className="w-full text-left p-3 hover:bg-accent/40 transition-colors"
                    onClick={() => setExpandedId(expanded ? null : v.id)}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium">{formatDate(v.visit_date)}</span>
                        <Badge className={cn('border-0 text-xs capitalize', typeClass(v.visit_type))}>
                          {t(`visitTypes.${v.visit_type}`)}
                        </Badge>
                        {v.clinic && <span className="text-xs text-muted-foreground truncate">{v.clinic.name}</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {labCount + recCount > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <Paperclip className="h-3 w-3" /> {labCount + recCount}
                          </span>
                        )}
                        {overdue && (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-0 text-xs">
                            {t('overdue')}
                          </Badge>
                        )}
                        {v.visit_cost != null && (
                          <span className="text-xs text-muted-foreground">
                            {Number(v.visit_cost).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {v.diagnosis && !expanded && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{v.diagnosis}</p>
                    )}

                    {v.health_ticket && (
                      <div className="text-xs text-amber-700 dark:text-amber-400 mt-1 flex items-center gap-1">
                        🎫 {t('linkedToTicket')}: {v.health_ticket.title}
                      </div>
                    )}
                  </button>

                  {expanded && (
                    <div className="border-t p-3 space-y-3 text-sm bg-muted/20">
                      {v.doctor && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">{t('fields.doctor')}: </span>
                          <span className="font-medium">{v.doctor.full_name}</span>
                          <span className="text-muted-foreground"> · {t(`specialisations.${v.doctor.specialisation}`)}</span>
                        </div>
                      )}
                      {v.chief_complaint && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground">{t('fields.chiefComplaint')}</div>
                          <p className="whitespace-pre-wrap">{v.chief_complaint}</p>
                        </div>
                      )}
                      {v.diagnosis && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground">{t('fields.diagnosis')}</div>
                          <p className="whitespace-pre-wrap">{v.diagnosis}</p>
                        </div>
                      )}
                      {v.treatment_performed && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground">{t('fields.treatment')}</div>
                          <p className="whitespace-pre-wrap">{v.treatment_performed}</p>
                        </div>
                      )}

                      {medCount > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">{t('medicinesPrescribed')}</div>
                          <ul className="space-y-0.5 text-xs">
                            {v.medicines.map((m) => (
                              <li key={m.id}>
                                • <span className="font-medium">{m.medicine_name}</span>
                                {m.dose && ` · ${m.dose}`}
                                {m.frequency && ` · ${m.frequency}`}
                                {m.duration && ` · ${m.duration}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {labCount > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">{t('labResults')}</div>
                          <div className="flex flex-wrap gap-2">
                            {labFiles.map((lab) => (
                              <a
                                key={lab.id}
                                href={lab.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent"
                              >
                                {lab.file_type === 'pdf'
                                  ? <FileText className="h-3.5 w-3.5 text-red-500" />
                                  : <ImageIcon className="h-3.5 w-3.5 text-blue-500" />}
                                <span className="truncate max-w-[140px]">{lab.file_name}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {recCount > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">{t('receipts')}</div>
                          <div className="flex flex-wrap gap-2">
                            {receiptFiles.map((rec) => (
                              <a
                                key={rec.id}
                                href={rec.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent"
                              >
                                {rec.file_type === 'pdf'
                                  ? <FileText className="h-3.5 w-3.5 text-red-500" />
                                  : <ImageIcon className="h-3.5 w-3.5 text-emerald-600" />}
                                <span className="truncate max-w-[140px]">{rec.file_name}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {v.follow_up_date && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">{t('fields.followUpDate')}: </span>
                          <span className={overdue ? 'text-red-600 font-medium' : ''}>{formatDate(v.follow_up_date)}</span>
                        </div>
                      )}

                      {v.notes && (
                        <p className="text-xs text-muted-foreground italic">{v.notes}</p>
                      )}

                      {isAdmin && (
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(t('confirmDeleteVisit'))) deleteVisit.mutate(v.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" /> {tc('delete')}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <VetVisitModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        catId={catId}
        catName={catName}
        role={role}
      />
    </>
  );
}
