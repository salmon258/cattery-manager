'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AlertCircle, MessageSquare, RefreshCw } from 'lucide-react';

import type { UserRole } from '@/lib/supabase/aliases';
import { uploadImage } from '@/lib/storage/upload';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { PhotoPicker } from '@/components/health/photo-picker';
import { cn, formatDate } from '@/lib/utils';

// ─── types ───────────────────────────────────────────────────────────────────
type PhotoRow = { id: string; url: string; event_id: string | null };

type EventRow = {
  id: string;
  event_type: 'comment' | 'status_change' | 'resolved' | 'reopened';
  note: string | null;
  new_status: 'open' | 'in_progress' | 'resolved' | null;
  created_at: string;
  author: { id: string; full_name: string } | null;
};

type TicketDetail = {
  id: string;
  cat_id: string;
  cat: { id: string; name: string } | null;
  title: string;
  description: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
  updated_at: string;
  creator: { id: string; full_name: string } | null;
  resolved_at: string | null;
  resolver: { id: string; full_name: string } | null;
  resolution_summary: string | null;
  photos: PhotoRow[];
  events: EventRow[];
};

async function fetchTicket(id: string): Promise<TicketDetail> {
  const r = await fetch(`/api/health-tickets/${id}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).ticket;
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function severityClass(s: string) {
  return {
    low:      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    medium:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    high:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  }[s] ?? '';
}

function statusClass(s: string) {
  return {
    open:        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    resolved:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  }[s] ?? '';
}

// ─── Photo grid ──────────────────────────────────────────────────────────────
function PhotoGrid({ photos }: { photos: PhotoRow[] }) {
  if (!photos.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {photos.map((p) => (
        <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer"
           className="relative h-20 w-20 rounded-md overflow-hidden border bg-muted block shrink-0 hover:opacity-80 transition-opacity">
          <Image src={p.url} alt="" fill sizes="80px" className="object-cover" />
        </a>
      ))}
    </div>
  );
}

// ─── component ───────────────────────────────────────────────────────────────
interface Props {
  ticketId: string;
  open: boolean;
  onClose: () => void;
  role: UserRole;
  invalidateKey?: unknown[];
}

export function HealthTicketModal({ ticketId, open, onClose, role, invalidateKey }: Props) {
  const t  = useTranslations('healthTickets');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const isAdmin = role === 'admin';

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['health-ticket', ticketId],
    queryFn:  () => fetchTicket(ticketId),
    enabled:  open && !!ticketId
  });

  // Comment form
  const [note, setNote]             = useState('');
  const [commentPhotos, setCommentPhotos] = useState<File[]>([]);
  // Status change
  const [nextStatus, setNextStatus] = useState<string>('');
  // Resolve form
  const [resolveMode, setResolveMode] = useState(false);
  const [resolution, setResolution]   = useState('');
  const [resolvePhotos, setResolvePhotos] = useState<File[]>([]);

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ['health-ticket', ticketId] });
    qc.invalidateQueries({ queryKey: ['health-tickets-count'] });
    if (invalidateKey) qc.invalidateQueries({ queryKey: invalidateKey });
    qc.invalidateQueries({ queryKey: ['me-cats'] });
  }

  async function uploadPhotos(files: File[], catId: string): Promise<string[]> {
    const urls: string[] = [];
    for (const file of files) {
      const { url } = await uploadImage('health-photos', file, `tickets/${catId}`);
      urls.push(url);
    }
    return urls;
  }

  const addEvent = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch(`/api/health-tickets/${ticketId}/events`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => { invalidateAll(); },
    onError:   (e: Error) => toast.error(e.message)
  });

  async function submitComment() {
    if (!note.trim() && commentPhotos.length === 0) return;
    const photo_urls = ticket ? await uploadPhotos(commentPhotos, ticket.cat_id) : [];
    addEvent.mutate(
      { event_type: 'comment', note: note.trim() || null, photo_urls },
      { onSuccess: () => { toast.success(t('eventAdded')); setNote(''); setCommentPhotos([]); } }
    );
  }

  function submitStatusChange() {
    if (!nextStatus) return;
    addEvent.mutate(
      { event_type: 'status_change', new_status: nextStatus, photo_urls: [] },
      { onSuccess: () => { toast.success(t('eventAdded')); setNextStatus(''); } }
    );
  }

  async function submitResolve() {
    if (!resolution.trim()) return;
    const photo_urls = ticket ? await uploadPhotos(resolvePhotos, ticket.cat_id) : [];
    addEvent.mutate(
      { event_type: 'resolved', resolution_summary: resolution, photo_urls },
      { onSuccess: () => {
        toast.success(t('resolvedMsg'));
        setResolution(''); setResolvePhotos([]); setResolveMode(false);
      }}
    );
  }

  function submitReopen() {
    addEvent.mutate(
      { event_type: 'reopened', photo_urls: [] },
      { onSuccess: () => { toast.success(t('reopenedMsg')); } }
    );
  }

  // Photos attached to ticket (no event_id)
  const ticketPhotos  = ticket?.photos.filter((p) => p.event_id === null) ?? [];
  // Map event_id → photos
  const eventPhotosMap = new Map<string, PhotoRow[]>();
  for (const p of ticket?.photos ?? []) {
    if (p.event_id) {
      if (!eventPhotosMap.has(p.event_id)) eventPhotosMap.set(p.event_id, []);
      eventPhotosMap.get(p.event_id)!.push(p);
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      title={ticket?.title ?? (isLoading ? tc('loading') : '—')}
      className="max-w-2xl"
    >
      {isLoading ? (
        <p className="py-4 text-sm text-muted-foreground">{tc('loading')}</p>
      ) : ticket ? (
        <div className="space-y-4 py-1">
          {/* Header badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn('border-0 capitalize', severityClass(ticket.severity))}>
              {t(`severities.${ticket.severity}`)}
            </Badge>
            <Badge className={cn('border-0 capitalize', statusClass(ticket.status))}>
              {t(`statuses.${ticket.status}`)}
            </Badge>
            {ticket.cat && (
              <span className="text-xs text-muted-foreground">{ticket.cat.name}</span>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {t('openedBy', { name: ticket.creator?.full_name ?? '—' })} · {formatDate(ticket.created_at)}
            </span>
          </div>

          {/* Description */}
          {ticket.description && (
            <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
          )}

          {/* Ticket-level photos (from initial report) */}
          {ticketPhotos.length > 0 && (
            <div className="border-b pb-3">
              <PhotoGrid photos={ticketPhotos} />
            </div>
          )}

          {/* Resolution summary (if resolved) */}
          {ticket.status === 'resolved' && ticket.resolution_summary && (
            <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 text-sm space-y-1">
              <div className="font-medium text-emerald-800 dark:text-emerald-300">
                {t('resolutionSummary')}
              </div>
              <p className="whitespace-pre-wrap text-emerald-900 dark:text-emerald-200">
                {ticket.resolution_summary}
              </p>
              {ticket.resolver && (
                <div className="text-xs text-emerald-700 dark:text-emerald-400">
                  {t('resolvedBy', { name: ticket.resolver.full_name })} · {formatDate(ticket.resolved_at!)}
                </div>
              )}
            </div>
          )}

          {/* Event thread */}
          {ticket.events.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> Activity
              </div>
              <ul className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {ticket.events.map((ev) => {
                  const evPhotos = eventPhotosMap.get(ev.id) ?? [];
                  return (
                    <li key={ev.id} className="text-sm border-l-2 border-muted pl-3">
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {ev.author?.full_name ?? '—'}
                        </span>{' '}
                        {t(`eventTypes.${ev.event_type}`)}
                        {ev.event_type === 'status_change' && ev.new_status && (
                          <span className={cn('ml-1 font-medium', statusClass(ev.new_status))}>
                            {t(`statuses.${ev.new_status}`)}
                          </span>
                        )}
                        {' · '}
                        {new Date(ev.created_at).toLocaleString()}
                      </div>
                      {ev.note && (
                        <p className="mt-0.5 whitespace-pre-wrap">{ev.note}</p>
                      )}
                      {evPhotos.length > 0 && <PhotoGrid photos={evPhotos} />}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Add comment */}
          {ticket.status !== 'resolved' && (
            <div className="space-y-2 border-t pt-3">
              <Label>{t('addComment')}</Label>
              <Textarea
                rows={3}
                placeholder={t('commentPlaceholder')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={addEvent.isPending}
              />
              <PhotoPicker
                files={commentPhotos}
                onChange={setCommentPhotos}
                disabled={addEvent.isPending}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={(!note.trim() && commentPhotos.length === 0) || addEvent.isPending}
                  onClick={submitComment}
                >
                  {addEvent.isPending ? tc('saving') : t('submitComment')}
                </Button>
              </div>
            </div>
          )}

          {/* Admin actions */}
          {isAdmin && ticket.status !== 'resolved' && (
            <div className="space-y-3 border-t pt-3">
              {/* Status change */}
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={nextStatus} onValueChange={setNextStatus}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder={t('changeStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(['open', 'in_progress'] as const)
                      .filter((s) => s !== ticket.status)
                      .map((s) => (
                        <SelectItem key={s} value={s}>{t(`statuses.${s}`)}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!nextStatus || addEvent.isPending}
                  onClick={submitStatusChange}
                >
                  {t('applyStatus')}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-900/20"
                  onClick={() => setResolveMode((v) => !v)}
                >
                  <AlertCircle className="h-3.5 w-3.5" /> {t('resolveTicket')}
                </Button>
              </div>

              {resolveMode && (
                <div className="space-y-2 rounded-md border p-3">
                  <Label>{t('resolutionSummary')}</Label>
                  <Textarea
                    rows={3}
                    placeholder={t('resolutionPlaceholder')}
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    disabled={addEvent.isPending}
                  />
                  <PhotoPicker
                    files={resolvePhotos}
                    onChange={setResolvePhotos}
                    disabled={addEvent.isPending}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setResolveMode(false); setResolution(''); setResolvePhotos([]); }}
                    >
                      {tc('cancel')}
                    </Button>
                    <Button
                      size="sm"
                      disabled={!resolution.trim() || addEvent.isPending}
                      onClick={submitResolve}
                    >
                      {addEvent.isPending ? tc('saving') : t('resolveTicket')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reopen (admin, resolved ticket) */}
          {isAdmin && ticket.status === 'resolved' && (
            <div className="border-t pt-3 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                disabled={addEvent.isPending}
                onClick={submitReopen}
              >
                <RefreshCw className="h-3.5 w-3.5" /> {t('reopen')}
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </ResponsiveModal>
  );
}
