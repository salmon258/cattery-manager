'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Edit, Home, MoveRight, Pencil, Trash2, Upload, User } from 'lucide-react';

import type { Cat, CatPhoto, UserRole } from '@/lib/supabase/aliases';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CatForm } from '@/components/cats/cat-form';
import { MoveRoomModal } from '@/components/cats/move-room-modal';
import { CatRoomHistory } from '@/components/cats/cat-room-history';
import { AssigneeHistory } from '@/components/assignees/assignee-history';
import { AssignCatModal } from '@/components/assignees/assign-cat-modal';
import { WeightCard } from '@/components/weight/weight-card';
import { EatingCard } from '@/components/eating/eating-card';
import { CatKcalBanner } from '@/components/cats/cat-kcal-banner';
import { VaccinationsCard } from '@/components/health/vaccinations-card';
import { PreventiveCard } from '@/components/health/preventive-card';
import { MedicationsCard } from '@/components/medications/medications-card';
import { MedicationHistoryCard } from '@/components/medications/medication-history-card';
import { HealthTicketsCard } from '@/components/health/health-tickets-card';
import { BreedingCard } from '@/components/breeding/breeding-card';
import { VetVisitsCard } from '@/components/vet/vet-visits-card';
import { uploadImage } from '@/lib/storage/upload';
import { formatDate } from '@/lib/utils';

interface Props {
  cat: Cat;
  initialPhotos: CatPhoto[];
  currentRoom: { id: string; name: string } | null;
  assignee: { id: string; full_name: string } | null;
  role: UserRole;
  currentUserId: string;
}

export function CatDetail({ cat, initialPhotos, currentRoom, assignee, role, currentUserId }: Props) {
  const t = useTranslations('cats');
  const tc = useTranslations('common');
  const tr = useTranslations('rooms');
  const ta = useTranslations('assignees');
  const ts = useTranslations('cats.status');
  const tg = useTranslations('cats.gender');
  const router = useRouter();
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [photos, setPhotos] = useState<CatPhoto[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [uploadingPedigree, setUploadingPedigree] = useState(false);

  const isAdmin = role === 'admin';

  async function handlePhotoUpload(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const { url, path } = await uploadImage('cat-photos', file, cat.id);
        const r = await fetch(`/api/cats/${cat.id}/photos`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url, storage_path: path })
        });
        if (!r.ok) throw new Error((await r.json()).error);
        const { photo } = await r.json();
        setPhotos((prev) => [...prev, photo]);
      }
      toast.success('Photos added');
      qc.invalidateQueries({ queryKey: ['cats'] });
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function deletePhoto(photoId: string) {
    const r = await fetch(`/api/cats/${cat.id}/photos?photo_id=${photoId}`, { method: 'DELETE' });
    if (!r.ok) {
      toast.error((await r.json()).error ?? 'Failed');
      return;
    }
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    router.refresh();
  }

  async function handlePedigreeUpload(file: File | null) {
    if (!file) return;
    setUploadingPedigree(true);
    try {
      const { url } = await uploadImage('pedigree-photos', file, cat.id);
      const r = await fetch(`/api/cats/${cat.id}/pedigree`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (!r.ok) throw new Error((await r.json()).error);
      toast.success('Pedigree uploaded');
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingPedigree(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            {cat.profile_photo_url ? <AvatarImage src={cat.profile_photo_url} alt={cat.name} /> : null}
            <AvatarFallback className="text-2xl">{cat.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              {cat.name}
              <Badge variant="secondary" className="capitalize">{ts(cat.status)}</Badge>
            </h1>
            <p className="text-sm text-muted-foreground">
              {tg(cat.gender)} · {cat.breed ?? '—'} · {formatDate(cat.date_of_birth)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setMoveOpen(true)}>
              <MoveRight className="h-4 w-4" /> {tr('moveAction')}
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Edit className="h-4 w-4" /> {tc('edit')}
            </Button>
          )}
        </div>
      </div>

      <CatKcalBanner catId={cat.id} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Overview</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-4 items-center">
              <span className="text-muted-foreground flex items-center gap-1">
                <Home className="h-3.5 w-3.5" /> {tr('currentRoom')}
              </span>
              <span className="font-medium">
                {currentRoom ? (
                  <Link href={`/rooms/${currentRoom.id}`} className="hover:underline">{currentRoom.name}</Link>
                ) : (
                  <span className="text-muted-foreground">{tr('unassigned')}</span>
                )}
              </span>
            </div>
            <div className="flex justify-between gap-4 items-center">
              <span className="text-muted-foreground flex items-center gap-1">
                <User className="h-3.5 w-3.5" /> {ta('primaryAssignee')}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-medium">
                  {assignee ? assignee.full_name : <span className="text-muted-foreground">{ta('unassigned')}</span>}
                </span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setAssignOpen(true)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={ta('changeTitle')}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </span>
            </div>
            <InfoRow label={t('fields.microchip')} value={cat.microchip_number} />
            <InfoRow label={t('fields.registration')} value={cat.registration_number} />
            <InfoRow label={t('fields.colorPattern')} value={cat.color_pattern} />
            {cat.notes && (
              <div className="pt-2 border-t">
                <div className="text-muted-foreground text-xs mb-1">{t('fields.notes')}</div>
                <p className="whitespace-pre-wrap">{cat.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">{t('fields.photos')}</CardTitle>
            <label className="cursor-pointer">
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePhotoUpload(e.target.files)}
              />
              <Button asChild size="sm" variant="outline" disabled={uploading}>
                <span><Upload className="h-4 w-4" /> {uploading ? tc('saving') : tc('create')}</span>
              </Button>
            </label>
          </CardHeader>
          <CardContent>
            {photos.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tc('empty')}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p) => {
                  const canDelete = isAdmin || p.created_by === currentUserId;
                  return (
                    <div key={p.id} className="relative aspect-square rounded-md overflow-hidden group">
                      <Image src={p.url} alt="" fill sizes="(max-width:768px) 33vw, 200px" className="object-cover" />
                      {p.is_profile && <Badge className="absolute top-1 left-1">Profile</Badge>}
                      {canDelete && (
                        <button
                          onClick={() => deletePhoto(p.id)}
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition bg-destructive text-destructive-foreground rounded p-1"
                          aria-label="delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <WeightCard catId={cat.id} role={role} currentUserId={currentUserId} />
        <EatingCard catId={cat.id} role={role} currentUserId={currentUserId} />

        <VaccinationsCard catId={cat.id} />
        <PreventiveCard catId={cat.id} />

        <MedicationsCard catId={cat.id} role={role} />

        <MedicationHistoryCard catId={cat.id} />

        <HealthTicketsCard catId={cat.id} role={role} />

        <VetVisitsCard catId={cat.id} catName={cat.name} role={role} />

        <BreedingCard catId={cat.id} catName={cat.name} catGender={cat.gender} role={role} />

        {/* Room history + pedigree are admin-only surfaces. Sitters don't see
            lineage paperwork or movement audit trails. */}
        {isAdmin && <CatRoomHistory catId={cat.id} />}
        {isAdmin && <AssigneeHistory catId={cat.id} />}

        {isAdmin && (
          <Card className="md:col-span-2">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">{t('fields.pedigree')}</CardTitle>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handlePedigreeUpload(e.target.files?.[0] ?? null)}
                />
                <Button asChild size="sm" variant="outline" disabled={uploadingPedigree}>
                  <span><Upload className="h-4 w-4" /> {uploadingPedigree ? tc('saving') : 'Upload'}</span>
                </Button>
              </label>
            </CardHeader>
            <CardContent>
              {cat.pedigree_photo_url ? (
                <div className="relative aspect-[4/3] max-w-md rounded-md overflow-hidden border">
                  <Image src={cat.pedigree_photo_url} alt="Pedigree" fill sizes="400px" className="object-contain" />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{tc('empty')}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <ResponsiveModal open={editOpen} onOpenChange={setEditOpen} title={tc('edit')}>
        <CatForm mode="edit" cat={cat} />
      </ResponsiveModal>

      <MoveRoomModal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        catId={cat.id}
        currentRoomId={cat.current_room_id}
      />

      <AssignCatModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        catId={cat.id}
        currentAssigneeId={cat.assignee_id}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || '—'}</span>
    </div>
  );
}
