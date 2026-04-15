'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Trash2, Receipt, X, FileText, Image as ImageIcon } from 'lucide-react';

import { uploadImage } from '@/lib/storage/upload';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

type VisitType   = 'routine_checkup' | 'emergency' | 'follow_up' | 'vaccination' | 'surgery' | 'dental' | 'other';
type VisitStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

type ClinicOption = {
  id: string; name: string;
  doctors: { id: string; full_name: string; is_active: boolean }[];
};

type TicketOption = { id: string; title: string; status: string };

type MedRoute = 'oral' | 'topical' | 'injection' | 'other';

type MedicineRow = {
  medicine_name: string;
  dose: string;
  frequency: string;
  duration: string;
  notes: string;
  // Optional structured scheduling — fills the medications.* table.
  // schedule_end_date is "" when the plan is indefinite (stop manually).
  schedule_enabled: boolean;
  schedule_start_date: string;
  schedule_end_date: string;
  schedule_interval_days: number;
  schedule_time_slots: string[];
  schedule_route: MedRoute;
};

type LabFile = { file: File; notes: string };

// An existing lab result / receipt already uploaded to the server. Stored
// separately from the draft `labFiles` list because it's not re-uploaded on
// save — only its delete flag is honoured.
type ExistingLabResult = {
  id: string;
  file_url: string;
  file_name: string;
  file_type: 'pdf' | 'image';
  kind: 'lab_result' | 'receipt';
  notes: string | null;
  _pendingDelete?: boolean;
};

interface Props {
  open: boolean;
  onClose: () => void;
  catId: string;
  catName: string;
  role?: 'admin' | 'cat_sitter';
  /** Optional — pre-link to a specific ticket (e.g. from within ticket modal) */
  prefilledTicketId?: string;
  /** Optional — when set, open the modal in edit mode for this existing visit. */
  editVisitId?: string;
}

const VISIT_TYPES: VisitType[]    = ['routine_checkup', 'emergency', 'follow_up', 'vaccination', 'surgery', 'dental', 'other'];
const VISIT_STATUSES: VisitStatus[] = ['scheduled', 'in_progress', 'completed', 'cancelled'];

export function VetVisitModal({ open, onClose, catId, catName, role, prefilledTicketId, editVisitId }: Props) {
  const isAdmin = role !== 'cat_sitter';
  const isEdit  = !!editVisitId;
  const ROUTES: MedRoute[] = ['oral', 'topical', 'injection', 'other'];
  const t  = useTranslations('vet');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  // Hidden file inputs — clicking the "Add file" buttons triggers these via
  // a ref. We avoid `<Button asChild><label>...</label></Button>` because
  // Radix Slot + label nesting has been flaky and prevented the click from
  // reaching the file input on some browsers.
  const labInputRef     = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split('T')[0];

  // ─── form state ──────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [visitDate, setVisitDate]   = useState(today);
  const [visitType, setVisitType]   = useState<VisitType>('routine_checkup');
  const [status, setStatus]         = useState<VisitStatus>('completed');
  const [clinicId, setClinicId]     = useState<string>('');
  const [doctorId, setDoctorId]     = useState<string>('');
  const [ticketId, setTicketId]     = useState<string>(prefilledTicketId ?? '');
  const [chiefComplaint, setChiefComplaint]   = useState('');
  const [diagnosis, setDiagnosis]             = useState('');
  const [treatment, setTreatment]             = useState('');
  const [followUpDate, setFollowUpDate]       = useState('');
  const [visitCost, setVisitCost]             = useState('');
  const [transportCost, setTransportCost]     = useState('');
  const [notes, setNotes]                     = useState('');
  const [medicines, setMedicines]             = useState<MedicineRow[]>([]);
  const [labFiles, setLabFiles]               = useState<LabFile[]>([]);
  const [receiptFiles, setReceiptFiles]       = useState<LabFile[]>([]);
  const [existingLabResults, setExistingLabResults] = useState<ExistingLabResult[]>([]);

  function resetForm() {
    setVisitDate(today); setVisitType('routine_checkup'); setStatus('completed');
    setClinicId(''); setDoctorId(''); setTicketId(prefilledTicketId ?? '');
    setChiefComplaint(''); setDiagnosis(''); setTreatment('');
    setFollowUpDate(''); setVisitCost(''); setTransportCost(''); setNotes('');
    setMedicines([]); setLabFiles([]); setReceiptFiles([]);
    setExistingLabResults([]);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && !isEdit) resetForm(); }, [open, isEdit]);

  // ─── data queries ────────────────────────────────────────────────────────
  const { data: clinics = [] } = useQuery<ClinicOption[]>({
    queryKey: ['clinics'],
    queryFn: async () => {
      const r = await fetch('/api/clinics?active=1', { cache: 'no-store' });
      if (!r.ok) return [];
      return (await r.json()).clinics;
    },
    enabled: open
  });

  // Load the existing visit when the modal is opened in edit mode so the
  // form can be pre-populated with the current values.
  const { data: existingVisit } = useQuery({
    queryKey: ['vet-visit', editVisitId],
    queryFn: async () => {
      const r = await fetch(`/api/vet-visits/${editVisitId}`, { cache: 'no-store' });
      if (!r.ok) return null;
      return (await r.json()).visit as {
        visit_date: string;
        visit_type: VisitType;
        status: VisitStatus;
        clinic_id: string | null;
        doctor_id: string | null;
        health_ticket_id: string | null;
        chief_complaint: string | null;
        diagnosis: string | null;
        treatment_performed: string | null;
        follow_up_date: string | null;
        visit_cost: number | null;
        transport_cost: number | null;
        notes: string | null;
        medicines: Array<{
          id: string;
          medicine_name: string;
          dose: string | null;
          frequency: string | null;
          duration: string | null;
          notes: string | null;
        }>;
        lab_results: ExistingLabResult[];
      };
    },
    enabled: open && isEdit
  });

  // Populate the form state when the visit loads (or the modal is reopened).
  useEffect(() => {
    if (!open || !isEdit || !existingVisit) return;
    setVisitDate(existingVisit.visit_date);
    setVisitType(existingVisit.visit_type);
    setStatus(existingVisit.status);
    setClinicId(existingVisit.clinic_id ?? '');
    setDoctorId(existingVisit.doctor_id ?? '');
    setTicketId(existingVisit.health_ticket_id ?? '');
    setChiefComplaint(existingVisit.chief_complaint ?? '');
    setDiagnosis(existingVisit.diagnosis ?? '');
    setTreatment(existingVisit.treatment_performed ?? '');
    setFollowUpDate(existingVisit.follow_up_date ?? '');
    setVisitCost(existingVisit.visit_cost != null ? String(existingVisit.visit_cost) : '');
    setTransportCost(existingVisit.transport_cost != null ? String(existingVisit.transport_cost) : '');
    setNotes(existingVisit.notes ?? '');
    setMedicines(
      existingVisit.medicines.map((m) => ({
        medicine_name: m.medicine_name,
        dose:          m.dose      ?? '',
        frequency:     m.frequency ?? '',
        duration:      m.duration  ?? '',
        notes:         m.notes     ?? '',
        // The detail GET doesn't include the schedule columns today, so we
        // default to disabled. Re-enabling from the edit modal will create a
        // brand-new schedule on save.
        schedule_enabled:       false,
        schedule_start_date:    today,
        schedule_end_date:      '',
        schedule_interval_days: 1,
        schedule_time_slots:    ['08:00', '20:00'],
        schedule_route:         'oral'
      }))
    );
    setExistingLabResults(existingVisit.lab_results ?? []);
    setLabFiles([]);
    setReceiptFiles([]);
  }, [open, isEdit, existingVisit, today]);

  // Open tickets for this cat (filter to non-resolved client-side)
  const { data: tickets = [] } = useQuery<TicketOption[]>({
    queryKey: ['cat-open-tickets', catId],
    queryFn: async () => {
      const r = await fetch(`/api/cats/${catId}/health-tickets`, { cache: 'no-store' });
      if (!r.ok) return [];
      const all = (await r.json()).tickets ?? [];
      return all.filter((tk: { status: string }) => tk.status !== 'resolved');
    },
    enabled: open
  });

  const selectedClinicDoctors = useMemo(() => {
    const c = clinics.find((c) => c.id === clinicId);
    return c?.doctors.filter((d) => d.is_active) ?? [];
  }, [clinics, clinicId]);

  // Reset doctor selection when clinic changes
  useEffect(() => {
    if (doctorId && !selectedClinicDoctors.find((d) => d.id === doctorId)) {
      setDoctorId('');
    }
  }, [clinicId, selectedClinicDoctors, doctorId]);

  // ─── medicine row helpers ────────────────────────────────────────────────
  function addMedicine() {
    const inAWeek = new Date(); inAWeek.setDate(inAWeek.getDate() + 6);
    setMedicines((m) => [...m, {
      medicine_name: '',
      dose: '',
      frequency: '',
      duration: '',
      notes: '',
      schedule_enabled: false,
      schedule_start_date: today,
      schedule_end_date: inAWeek.toISOString().slice(0, 10),
      schedule_interval_days: 1,
      schedule_time_slots: ['08:00', '20:00'],
      schedule_route: 'oral'
    }]);
  }
  function removeMedicine(i: number) {
    setMedicines((m) => m.filter((_, idx) => idx !== i));
  }
  function updateMedicine<K extends keyof MedicineRow>(i: number, field: K, value: MedicineRow[K]) {
    setMedicines((m) => m.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  }
  function updateMedSlot(medIdx: number, slotIdx: number, value: string) {
    setMedicines((m) => m.map((row, idx) => {
      if (idx !== medIdx) return row;
      const next = [...row.schedule_time_slots];
      next[slotIdx] = value;
      return { ...row, schedule_time_slots: next };
    }));
  }
  function addMedSlot(medIdx: number) {
    setMedicines((m) => m.map((row, idx) =>
      idx === medIdx ? { ...row, schedule_time_slots: [...row.schedule_time_slots, '12:00'] } : row
    ));
  }
  function removeMedSlot(medIdx: number, slotIdx: number) {
    setMedicines((m) => m.map((row, idx) => {
      if (idx !== medIdx) return row;
      if (row.schedule_time_slots.length <= 1) return row;
      return { ...row, schedule_time_slots: row.schedule_time_slots.filter((_, i) => i !== slotIdx) };
    }));
  }

  // ─── lab + receipt file helpers ──────────────────────────────────────────
  function handleFileSelect(setter: React.Dispatch<React.SetStateAction<LabFile[]>>) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? []);
      setter((prev) => [...prev, ...selected.map((f) => ({ file: f, notes: '' }))]);
      e.target.value = '';
    };
  }
  function removeFile(setter: React.Dispatch<React.SetStateAction<LabFile[]>>, i: number) {
    setter((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateFileNote(setter: React.Dispatch<React.SetStateAction<LabFile[]>>, i: number, value: string) {
    setter((prev) => prev.map((row, idx) => idx === i ? { ...row, notes: value } : row));
  }

  // ─── submit ─────────────────────────────────────────────────────────────
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Validate medicines (name required). Include scheduling fields when
      // schedule_enabled so the API can auto-create a medications row.
      const cleanMedicines = medicines
        .filter((m) => m.medicine_name.trim())
        .map((m) => ({
          medicine_name: m.medicine_name.trim(),
          dose:          m.dose.trim() || null,
          frequency:     m.frequency.trim() || null,
          duration:      m.duration.trim() || null,
          notes:         m.notes.trim() || null,
          schedule_enabled: m.schedule_enabled,
          ...(m.schedule_enabled && {
            schedule_start_date:    m.schedule_start_date,
            // Empty end date → null (indefinite, stop manually).
            schedule_end_date:      m.schedule_end_date || null,
            schedule_interval_days: m.schedule_interval_days,
            schedule_time_slots:    m.schedule_time_slots,
            schedule_route:         m.schedule_route
          })
        }));

      // Client-side guard for scheduled meds — server validates again.
      for (const m of cleanMedicines) {
        if (m.schedule_enabled) {
          if (!m.dose) throw new Error(`"${m.medicine_name}" needs a dose to be scheduled.`);
          if (!m.schedule_start_date) {
            throw new Error(`"${m.medicine_name}" needs a start date.`);
          }
          if ((m.schedule_time_slots?.length ?? 0) === 0) {
            throw new Error(`"${m.medicine_name}" needs at least one time slot.`);
          }
        }
      }

      const payload = {
        clinic_id:        clinicId || null,
        doctor_id:        doctorId || null,
        health_ticket_id: ticketId || null,
        visit_date:       visitDate,
        visit_type:       visitType,
        status,
        chief_complaint:     chiefComplaint.trim() || null,
        diagnosis:           diagnosis.trim() || null,
        treatment_performed: treatment.trim() || null,
        follow_up_date:      followUpDate || null,
        visit_cost:          visitCost     ? Number(visitCost)     : null,
        transport_cost:      transportCost ? Number(transportCost) : null,
        notes:               notes.trim() || null,
        medicines:           cleanMedicines
      };

      // POST (create) vs PATCH (edit) — both accept the same payload shape.
      const r = await fetch(
        isEdit ? `/api/vet-visits/${editVisitId}` : `/api/cats/${catId}/vet-visits`,
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
      const visitId = isEdit ? editVisitId! : (await r.json()).visit.id;

      // Delete any existing lab results marked for removal (edit mode).
      for (const lr of existingLabResults) {
        if (!lr._pendingDelete) continue;
        await fetch(`/api/vet-visits/${visitId}/lab-results/${lr.id}`, { method: 'DELETE' });
      }

      // Upload lab files + receipt files. Same endpoint, different `kind`.
      async function uploadAndAttach(files: LabFile[], kind: 'lab_result' | 'receipt') {
        for (const f of files) {
          const isPdf = f.file.type === 'application/pdf';
          const { url, path } = await uploadImage('lab-results', f.file, `visits/${visitId}/${kind}`);
          await fetch(`/api/vet-visits/${visitId}/lab-results`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              file_url:        url,
              storage_path:    path,
              file_type:       isPdf ? 'pdf' : 'image',
              file_name:       f.file.name,
              file_size_bytes: f.file.size,
              notes:           f.notes.trim() || null,
              kind
            })
          });
        }
      }
      await uploadAndAttach(labFiles,     'lab_result');
      await uploadAndAttach(receiptFiles, 'receipt');

      // If any medication schedule was created, refresh the medication query.
      if (cleanMedicines.some((m) => m.schedule_enabled)) {
        qc.invalidateQueries({ queryKey: ['medications', catId] });
        qc.invalidateQueries({ queryKey: ['me-tasks'] });
        qc.invalidateQueries({ queryKey: ['daily-progress'] });
      }

      toast.success(isEdit ? t('visitUpdated') : t('visitCreated'));
      qc.invalidateQueries({ queryKey: ['vet-visits', catId] });
      if (isEdit) qc.invalidateQueries({ queryKey: ['vet-visit', editVisitId] });
      if (ticketId) {
        qc.invalidateQueries({ queryKey: ['health-ticket', ticketId] });
        qc.invalidateQueries({ queryKey: ['health-tickets', catId] });
      }
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      title={`${isEdit ? t('editVisit') : t('newVisit')} — ${catName}`}
      className="max-w-2xl"
    >
      <form onSubmit={onSubmit} className="space-y-4 py-2">
        {/* Date + Type + Status */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="vv-date">{t('fields.visitDate')}</Label>
            <Input id="vv-date" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vv-type">{t('fields.visitType')}</Label>
            <Select value={visitType} onValueChange={(v) => setVisitType(v as VisitType)}>
              <SelectTrigger id="vv-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VISIT_TYPES.map((v) => (
                  <SelectItem key={v} value={v}>{t(`visitTypes.${v}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vv-status">{t('fields.status')}</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as VisitStatus)}>
              <SelectTrigger id="vv-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VISIT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{t(`visitStatuses.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Clinic + Doctor */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t('fields.clinic')}</Label>
            <Select value={clinicId} onValueChange={setClinicId}>
              <SelectTrigger><SelectValue placeholder={t('placeholders.selectClinic')} /></SelectTrigger>
              <SelectContent>
                {clinics.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.doctor')}</Label>
            <Select value={doctorId} onValueChange={setDoctorId} disabled={!clinicId}>
              <SelectTrigger>
                <SelectValue placeholder={clinicId ? t('placeholders.selectDoctor') : t('placeholders.selectClinicFirst')} />
              </SelectTrigger>
              <SelectContent>
                {selectedClinicDoctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Ticket linking */}
        {tickets.length > 0 && (
          <div className="space-y-1.5 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-3">
            <Label>{t('linkToTicket')}</Label>
            <Select value={ticketId || 'none'} onValueChange={(v) => setTicketId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder={t('placeholders.selectTicket')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('noTicketLink')}</SelectItem>
                {tickets.map((tk) => (
                  <SelectItem key={tk.id} value={tk.id}>{tk.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t('linkHint')}</p>
          </div>
        )}

        {/* Complaint + diagnosis + treatment */}
        <div className="space-y-1.5">
          <Label htmlFor="vv-complaint">{t('fields.chiefComplaint')}</Label>
          <Input id="vv-complaint" value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vv-diagnosis">{t('fields.diagnosis')}</Label>
          <Textarea id="vv-diagnosis" rows={2} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vv-treatment">{t('fields.treatment')}</Label>
          <Textarea id="vv-treatment" rows={2} value={treatment} onChange={(e) => setTreatment(e.target.value)} />
        </div>

        {/* Follow-up + costs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="vv-followup">{t('fields.followUpDate')}</Label>
            <Input id="vv-followup" type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vv-cost">{t('fields.visitCost')}</Label>
            <CurrencyInput id="vv-cost" value={visitCost} onChange={setVisitCost} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vv-transport">{t('fields.transportCost')}</Label>
            <CurrencyInput id="vv-transport" value={transportCost} onChange={setTransportCost} placeholder="0" />
          </div>
        </div>

        {/* Medicines */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t('medicinesPrescribed')}</Label>
            <Button type="button" variant="outline" size="sm" onClick={addMedicine}>
              <Plus className="h-3 w-3" /> {t('addMedicine')}
            </Button>
          </div>
          {medicines.map((med, i) => (
            <div key={i} className="rounded-md border p-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <Input
                  placeholder={t('fields.medicineName')}
                  value={med.medicine_name}
                  onChange={(e) => updateMedicine(i, 'medicine_name', e.target.value)}
                  className="flex-1"
                />
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeMedicine(i)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder={t('fields.dose')}      value={med.dose}      onChange={(e) => updateMedicine(i, 'dose', e.target.value)} />
                <Input placeholder={t('fields.frequency')} value={med.frequency} onChange={(e) => updateMedicine(i, 'frequency', e.target.value)} />
                <Input placeholder={t('fields.duration')}  value={med.duration}  onChange={(e) => updateMedicine(i, 'duration', e.target.value)} />
              </div>

              {/* Auto-schedule toggle (admin only) */}
              {isAdmin && (
                <div className="border-t pt-1.5 mt-1.5 space-y-1.5">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={med.schedule_enabled}
                      onChange={(e) => updateMedicine(i, 'schedule_enabled', e.target.checked)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="font-medium">{t('autoSchedule')}</span>
                    <span className="text-muted-foreground">— {t('autoScheduleHint')}</span>
                  </label>

                  {med.schedule_enabled && (
                    <div className="space-y-1.5 pl-5">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-[10px] uppercase text-muted-foreground">{t('fields.startDate')}</Label>
                          <Input
                            type="date"
                            value={med.schedule_start_date}
                            onChange={(e) => updateMedicine(i, 'schedule_start_date', e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] uppercase text-muted-foreground">{t('fields.endDate')}</Label>
                          <Input
                            type="date"
                            value={med.schedule_end_date}
                            onChange={(e) => updateMedicine(i, 'schedule_end_date', e.target.value)}
                            disabled={med.schedule_end_date === ''}
                            className="h-8 text-xs"
                          />
                          <label className="flex items-center gap-1 text-[10px] cursor-pointer mt-0.5 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={med.schedule_end_date === ''}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  updateMedicine(i, 'schedule_end_date', '');
                                } else {
                                  const d = new Date(); d.setDate(d.getDate() + 6);
                                  updateMedicine(i, 'schedule_end_date', d.toISOString().slice(0, 10));
                                }
                              }}
                              className="h-3 w-3"
                            />
                            <span>{t('indefinite')}</span>
                          </label>
                        </div>
                        <div>
                          <Label className="text-[10px] uppercase text-muted-foreground">{t('fields.intervalDays')}</Label>
                          <Input
                            type="number"
                            min={1} max={365}
                            value={med.schedule_interval_days}
                            onChange={(e) => updateMedicine(i, 'schedule_interval_days', Math.max(1, Number(e.target.value) || 1))}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">{t('fields.route')}</Label>
                        <Select value={med.schedule_route} onValueChange={(v) => updateMedicine(i, 'schedule_route', v as MedRoute)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROUTES.map((r) => (
                              <SelectItem key={r} value={r}>{t(`routes.${r}`)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] uppercase text-muted-foreground">{t('fields.timeSlots')}</Label>
                          <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-1.5" onClick={() => addMedSlot(i)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {med.schedule_time_slots.map((s, si) => (
                            <div key={si} className="flex items-center gap-0.5 rounded border px-1 py-0.5">
                              <Input
                                type="time"
                                value={s}
                                onChange={(e) => updateMedSlot(i, si, e.target.value)}
                                className="h-6 w-20 border-0 p-0 text-xs focus-visible:ring-0"
                              />
                              {med.schedule_time_slots.length > 1 && (
                                <button type="button" onClick={() => removeMedSlot(i, si)} className="text-muted-foreground hover:text-destructive">
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Lab results */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t('labResults')}</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => labInputRef.current?.click()}
            >
              <Plus className="h-3 w-3" /> {t('addLabResult')}
            </Button>
            <input
              ref={labInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={handleFileSelect(setLabFiles)}
            />
          </div>
          {/* Already-uploaded files (edit mode) */}
          {existingLabResults.filter((lr) => lr.kind !== 'receipt').map((lr) => (
            <ExistingFileRow
              key={lr.id}
              lr={lr}
              onToggleDelete={() =>
                setExistingLabResults((prev) => prev.map((r) =>
                  r.id === lr.id ? { ...r, _pendingDelete: !r._pendingDelete } : r
                ))
              }
            />
          ))}
          {labFiles.map((lab, i) => (
            <div key={i} className="rounded-md border p-2 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm truncate">{lab.file.name}</span>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(setLabFiles, i)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
              <Input
                placeholder={t('placeholders.labNote')}
                value={lab.notes}
                onChange={(e) => updateFileNote(setLabFiles, i, e.target.value)}
                className="h-7 text-xs"
              />
            </div>
          ))}
        </div>

        {/* Receipts */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
              {t('receipts')}
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => receiptInputRef.current?.click()}
            >
              <Plus className="h-3 w-3" /> {t('addReceipt')}
            </Button>
            <input
              ref={receiptInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={handleFileSelect(setReceiptFiles)}
            />
          </div>
          {/* Already-uploaded receipts (edit mode) */}
          {existingLabResults.filter((lr) => lr.kind === 'receipt').map((lr) => (
            <ExistingFileRow
              key={lr.id}
              lr={lr}
              onToggleDelete={() =>
                setExistingLabResults((prev) => prev.map((r) =>
                  r.id === lr.id ? { ...r, _pendingDelete: !r._pendingDelete } : r
                ))
              }
            />
          ))}
          {receiptFiles.map((rec, i) => (
            <div key={i} className="rounded-md border p-2 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm truncate">{rec.file.name}</span>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(setReceiptFiles, i)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
              <Input
                placeholder={t('placeholders.receiptNote')}
                value={rec.notes}
                onChange={(e) => updateFileNote(setReceiptFiles, i, e.target.value)}
                className="h-7 text-xs"
              />
            </div>
          ))}
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="vv-notes">{tc('notes')}</Label>
          <Textarea id="vv-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? tc('saving') : tc('save')}
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}

// Row for a lab result / receipt that already exists on the server. Clicking
// the trash icon toggles a pending-delete flag; the delete actually happens
// on save so users can undo before confirming.
function ExistingFileRow({
  lr,
  onToggleDelete
}: {
  lr: ExistingLabResult;
  onToggleDelete: () => void;
}) {
  const pending = lr._pendingDelete === true;
  return (
    <div
      className={`rounded-md border p-2 flex items-center justify-between gap-2 ${
        pending ? 'opacity-50 line-through bg-destructive/5' : ''
      }`}
    >
      <a
        href={lr.file_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-sm min-w-0"
      >
        {lr.file_type === 'pdf'
          ? <FileText className="h-3.5 w-3.5 text-red-500 shrink-0" />
          : <ImageIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
        <span className="truncate">{lr.file_name}</span>
      </a>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={onToggleDelete}
      >
        {pending
          ? <X className="h-3.5 w-3.5" />
          : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
      </Button>
    </div>
  );
}
