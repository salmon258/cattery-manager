'use client';

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Phone, Mail, Globe, MapPin, Stethoscope } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClinicModal } from './clinic-modal';
import { DoctorModal } from './doctor-modal';

type DoctorRow = {
  id: string;
  full_name: string;
  specialisation: 'general' | 'dermatology' | 'cardiology' | 'oncology' | 'dentistry' | 'surgery' | 'other';
  is_active: boolean;
};

type ClinicRow = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
  is_active: boolean;
  doctors: DoctorRow[];
};

export function ClinicsClient() {
  const t  = useTranslations('vet');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const [clinicModalOpen, setClinicModalOpen] = useState(false);
  const [editingClinic, setEditingClinic]     = useState<ClinicRow | null>(null);
  const [doctorModalOpen, setDoctorModalOpen] = useState(false);
  const [doctorContext, setDoctorContext]     = useState<{ clinicId: string; doctor?: DoctorRow } | null>(null);

  const { data: clinics = [], isLoading, error } = useQuery<ClinicRow[]>({
    queryKey: ['clinics'],
    queryFn: async () => {
      const r = await fetch('/api/clinics', { cache: 'no-store' });
      if (!r.ok) throw new Error('Failed');
      return (await r.json()).clinics;
    }
  });

  const deleteClinic = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/clinics/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinics'] });
      toast.success(t('clinicDeleted'));
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const deleteDoctor = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/doctors/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinics'] });
      toast.success(t('doctorDeleted'));
    },
    onError: (e: Error) => toast.error(e.message)
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Button onClick={() => { setEditingClinic(null); setClinicModalOpen(true); }}>
          <Plus className="h-4 w-4" /> {t('newClinic')}
        </Button>
      </div>

      {isLoading && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{tc('loading')}</CardContent></Card>
      )}
      {error && (
        <Card><CardContent className="p-6 text-sm text-destructive">{tc('error')}</CardContent></Card>
      )}
      {!isLoading && !error && clinics.length === 0 && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{t('noClinics')}</CardContent></Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {clinics.map((clinic) => (
          <Card key={clinic.id} className={clinic.is_active ? '' : 'opacity-60'}>
            <CardHeader className="flex-row items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base flex items-center gap-2">
                  {clinic.name}
                  {!clinic.is_active && <Badge variant="outline" className="text-xs">{t('inactive')}</Badge>}
                </CardTitle>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingClinic(clinic); setClinicModalOpen(true); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                  onClick={() => {
                    if (confirm(t('confirmDeleteClinic'))) deleteClinic.mutate(clinic.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Contact info */}
              <div className="space-y-1 text-sm text-muted-foreground">
                {clinic.address && <div className="flex items-start gap-1.5"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span>{clinic.address}</span></div>}
                {clinic.phone   && <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /><a href={`tel:${clinic.phone}`} className="hover:underline">{clinic.phone}</a></div>}
                {clinic.email   && <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /><a href={`mailto:${clinic.email}`} className="hover:underline truncate">{clinic.email}</a></div>}
                {clinic.website && <div className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /><a href={clinic.website} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">{clinic.website}</a></div>}
              </div>

              {/* Doctors */}
              <div className="border-t pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('doctors')}</h4>
                  <Button
                    size="sm" variant="outline" className="h-6 text-xs"
                    onClick={() => { setDoctorContext({ clinicId: clinic.id }); setDoctorModalOpen(true); }}
                  >
                    <Plus className="h-3 w-3" /> {t('addDoctor')}
                  </Button>
                </div>
                {clinic.doctors.length === 0 && (
                  <p className="text-xs text-muted-foreground">{t('noDoctors')}</p>
                )}
                <ul className="space-y-1">
                  {clinic.doctors.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between text-sm group">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Stethoscope className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className={doc.is_active ? '' : 'line-through text-muted-foreground'}>{doc.full_name}</span>
                        <span className="text-xs text-muted-foreground">· {t(`specialisations.${doc.specialisation}`)}</span>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => { setDoctorContext({ clinicId: clinic.id, doctor: doc }); setDoctorModalOpen(true); }}
                          aria-label="edit"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => { if (confirm(t('confirmDeleteDoctor'))) deleteDoctor.mutate(doc.id); }}
                          aria-label="delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {clinic.notes && (
                <p className="text-xs text-muted-foreground italic border-t pt-2">{clinic.notes}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <ClinicModal
        open={clinicModalOpen}
        onClose={() => { setClinicModalOpen(false); setEditingClinic(null); }}
        clinic={editingClinic}
      />

      {doctorContext && (
        <DoctorModal
          open={doctorModalOpen}
          onClose={() => { setDoctorModalOpen(false); setDoctorContext(null); }}
          clinicId={doctorContext.clinicId}
          doctor={doctorContext.doctor}
        />
      )}
    </div>
  );
}
