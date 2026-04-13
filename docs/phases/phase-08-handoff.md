# Phase 8 — Health Tickets — Handoff

**Completed by:** Claude (Sonnet 4.6)
**Completed at:** 2026-04-13
**Branch / commit:** `main` @ (uncommitted)
**Spec version ref:** `cattery-management-spec.md` §6 (Health Tickets)

---

## What Was Built

### Database
- **`health_tickets`** — one row per health episode per cat
  - `id`, `cat_id`, `title`, `description`, `severity` (low/medium/high/critical), `status` (open/in_progress/resolved)
  - `created_by`, `resolved_at`, `resolved_by`, `resolution_summary`, `created_at`, `updated_at`
  - FK constraint names explicit for PostgREST embedded selects: `health_tickets_created_by_fkey`, `health_tickets_resolved_by_fkey`
- **`health_ticket_events`** — append-only activity thread
  - `id`, `ticket_id`, `event_type` (comment/status_change/resolved/reopened), `note`, `new_status`, `created_by`, `created_at`
  - FK: `health_ticket_events_created_by_fkey`
- **Enums**: `ticket_severity`, `ticket_status`, `ticket_event_type`
- **RLS**: all active users can read/insert tickets + events; only admins can update tickets

### API Routes

| Method | Route | Who | What |
|---|---|---|---|
| `GET` | `/api/cats/[id]/health-tickets` | all | List all tickets for a cat (open + resolved) |
| `POST` | `/api/cats/[id]/health-tickets` | all | Open a new ticket |
| `GET` | `/api/health-tickets` | admin | List all open/in-progress tickets; `?severity=` filter; `?count_only=1` for count |
| `GET` | `/api/health-tickets/[id]` | all | Full ticket + event thread |
| `POST` | `/api/health-tickets/[id]/events` | all/admin | Add event; side-effects update ticket status |

### UI Components

- **`components/health/open-ticket-modal.tsx`** — form to open a new ticket (title, description, severity)
- **`components/health/health-ticket-modal.tsx`** — view ticket + thread, add comments, admin status/resolve/reopen actions
- **`components/health/health-tickets-card.tsx`** — card on cat detail: shows open tickets sorted by severity, resolved collapsible, "Open ticket" button

### Admin Page
- **`app/(app)/health-tickets/page.tsx`** — all open tickets across all cats, severity filter, click to open `HealthTicketModal`
- Linked from admin sidebar as "Health Tickets" (`HeartPulse` icon) with live open-count badge

### Integrations
- **`components/cats/cat-detail.tsx`** — `<HealthTicketsCard>` added after `<MedicationsCard>`, visible to both admins and sitters
- **`components/cats/my-cats-client.tsx`**:
  - "Report Issue" button now opens `<OpenTicketModal>` instead of showing a coming-soon toast
  - Open ticket count badge (orange) shown next to cat name
  - `open_ticket_count` sourced from `/api/me/cats`
- **`app/api/me/cats/route.ts`** — enriched with `open_ticket_count` (open + in_progress tickets per cat) alongside `last_weight_recorded_at`
- **`components/app/admin-sidebar.tsx`** — "Health Tickets" nav item with live count badge (`useQuery` fetching `/api/health-tickets?count_only=1`, 60s stale time)

---

## Migration: apply before testing

```bash
supabase db push
# or locally:
supabase migration up
```

Then re-run types and uncomment the Phase 8 aliases:

```bash
supabase gen types typescript --local > lib/supabase/types.ts
# Re-append the full aliases block from lib/supabase/types.ts bottom
```

After regen, in `lib/supabase/types.ts` uncomment:
```ts
export type HealthTicket = Database['public']['Tables']['health_tickets']['Row']
export type HealthTicketEvent = Database['public']['Tables']['health_ticket_events']['Row']
export type TicketSeverity = Database['public']['Enums']['ticket_severity']
export type TicketStatus = Database['public']['Enums']['ticket_status']
export type TicketEventType = Database['public']['Enums']['ticket_event_type']
```

Then remove the `// eslint-disable-next-line @typescript-eslint/no-explicit-any` + `(supabase as any)` casts in:
- `app/api/cats/[id]/health-tickets/route.ts`
- `app/api/health-tickets/route.ts`
- `app/api/health-tickets/[id]/route.ts`
- `app/api/health-tickets/[id]/events/route.ts`
- `app/api/me/cats/route.ts` (the `openTickets` query)

---

## Files Added / Modified

| File | Change |
|---|---|
| `supabase/migrations/20260419000000_phase8_health_tickets.sql` | New — DB tables + enums + RLS |
| `lib/schemas/health-tickets.ts` | New — Zod schemas |
| `app/api/cats/[id]/health-tickets/route.ts` | New |
| `app/api/health-tickets/route.ts` | New |
| `app/api/health-tickets/[id]/route.ts` | New |
| `app/api/health-tickets/[id]/events/route.ts` | New |
| `components/health/open-ticket-modal.tsx` | New |
| `components/health/health-ticket-modal.tsx` | New |
| `components/health/health-tickets-card.tsx` | New |
| `app/(app)/health-tickets/page.tsx` | New — admin list page |
| `app/api/me/cats/route.ts` | Added `open_ticket_count` |
| `components/cats/cat-detail.tsx` | Added `<HealthTicketsCard>` |
| `components/cats/my-cats-client.tsx` | Wired Report Issue → `<OpenTicketModal>`, added ticket badge |
| `components/app/admin-sidebar.tsx` | Added Health Tickets nav item + live badge |
| `messages/en.json` | Added `healthTickets` section + `nav.healthTickets` |
| `messages/id.json` | Added `healthTickets` section + `nav.healthTickets` |
| `lib/supabase/types.ts` | Commented-out Phase 8 aliases (uncomment after migration + regen) |

---

## Notes for Next Agent

> Read this before starting **Phase 9 — Breeding** per §16.3.

### Key patterns established in Phase 8
- **Ticket event side-effects**: `POST /events` mutates the parent ticket atomically (single request, no separate PATCH needed from the UI). Replicate this pattern for any "append + update parent" flow.
- **Live badge in sidebar**: `useQuery({ queryKey: ['health-tickets-count'], staleTime: 60_000 })` — the sidebar is a client component so React Query works. Reuse for other count badges.
- **Severity/status color helpers**: `severityClass()` and `statusClass()` utility functions in `health-ticket-modal.tsx` and `health-tickets-card.tsx` — consider extracting to `lib/utils` if reused in Phase 9+.

### Next Phase Preview

**Phase 9 — Breeding** — litter records, stud pairing, pregnancy tracking, kitten birth log.

Expected work:
- **DB**: `litters` (dam, sire, mating_date, due_date, birth_date), `kittens` (litter_id, name, gender, birth_weight, status), `stud_pairings`
- **API**: CRUD litters; add kittens to litter; link cats (dam/sire) to litter
- **UI**: `<BreedingCard>` on cat detail (for queens/toms); litter detail page; kitten grid
- **Admin**: Breeding page `/breeding` with active litters overview
