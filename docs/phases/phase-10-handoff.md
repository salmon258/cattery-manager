# Phase 10 — Vet & Medical — Handoff

**Completed by:** Claude (Sonnet 4.6)
**Completed at:** 2026-04-13
**Branch / commit:** `main` @ (uncommitted)
**Spec version ref:** `cattery-management-spec.md` §4 (Vet & Doctor Tracking) + §6.5 (Vet Visit Linking)

---

## What Was Built

### Database
- **`clinics`** — name, address, phone, email, website, notes, is_active
- **`doctors`** — full_name, clinic_id (FK), specialisation, phone, notes, is_active
- **`vet_visits`** — per-cat vet visit with:
  - `clinic_id`, `doctor_id`, `cat_id`
  - `health_ticket_id` (nullable FK to health_tickets) — **ticket integration linkage**
  - `visit_date`, `visit_type` (routine_checkup / emergency / follow_up / vaccination / surgery / dental / other)
  - `status` (scheduled / in_progress / completed / cancelled)
  - `chief_complaint`, `diagnosis`, `treatment_performed`
  - `follow_up_date`, `visit_cost`, `transport_cost`, `notes`
- **`vet_visit_medicines`** — repeatable medicine rows per visit (`medicine_name`, `dose`, `frequency`, `duration`, `notes`)
- **`lab_results`** — file attachments per visit (`file_url`, `storage_path`, `file_type` (pdf|image), `file_name`, `file_size_bytes`, `notes`)
- **Enums**: `doctor_specialisation`, `vet_visit_type`, `vet_visit_status`, `lab_result_file_type`
- **RLS**: all authenticated users read + insert vet visits / medicines / lab results; only admins manage clinics, doctors, and update/delete visits
- **Storage bucket**: `lab-results` (public) for PDF + image uploads

### Ticket Integration (the key requirement)
- Added `vet_referral` value to `ticket_event_type` enum
- Added `linked_vet_visit_id` nullable column on `health_ticket_events`
- When a vet visit is created with `health_ticket_id` set, the API atomically inserts a `vet_referral` event on the ticket thread with the diagnosis/complaint as the note
- Ticket GET query joins `vet_visits` via the FK so the thread renders visit details inline

### API Routes

| Method | Route | Who | What |
|---|---|---|---|
| `GET/POST` | `/api/clinics` | all GET, admin POST | List/create clinics (with embedded doctors) |
| `PATCH/DELETE` | `/api/clinics/[id]` | admin | Edit/delete clinic |
| `GET/POST` | `/api/doctors` | all GET, admin POST | List (filter by `?clinic_id=`, `?active=1`) / create |
| `PATCH/DELETE` | `/api/doctors/[id]` | admin | Edit/delete doctor |
| `GET/POST` | `/api/cats/[id]/vet-visits` | all | List visits for a cat / create a new visit (**side-effect: creates vet_referral ticket event if linked**) |
| `GET` | `/api/vet-visits/[id]` | all | Full visit detail |
| `DELETE` | `/api/vet-visits/[id]` | admin | Delete visit |
| `POST` | `/api/vet-visits/[id]/lab-results` | all | Attach a lab result file (after client-side upload) |
| `DELETE` | `/api/lab-results/[id]` | admin | Delete a lab result |

### UI Components

- **`components/vet/clinics-client.tsx`** — admin page content: list of clinic cards, each expandable to show doctors, inline add/edit/delete buttons
- **`components/vet/clinic-modal.tsx`** — create/edit clinic form
- **`components/vet/doctor-modal.tsx`** — create/edit doctor form (scoped to a clinic)
- **`components/vet/vet-visit-modal.tsx`** — create vet visit form with:
  - Date, type, status
  - Clinic selector → doctor selector (cascading dropdown)
  - **Ticket linking dropdown** — auto-shows only when the cat has open tickets (yellow/amber highlight box)
  - Chief complaint / diagnosis / treatment
  - Follow-up date, visit cost, transport cost
  - Dynamic medicines rows (name, dose, frequency, duration)
  - Lab file picker (PDFs + images) with per-file notes
- **`components/vet/vet-visits-card.tsx`** — card shown on cat detail page:
  - Shows all vet visits in reverse-chronological order
  - Click to expand → full details including medicines and lab result cards (linking to files)
  - **Overdue follow-up warning** banner if a `follow_up_date` passed without a follow-up visit logged
  - Paperclip icon shows lab result count on collapsed view
  - Link badge if visit is connected to a ticket
  - Admin-only delete button

### Admin Page
- **`app/(app)/clinics/page.tsx`** → `<ClinicsClient>` — admin only (redirects non-admins)
- Sidebar link "Clinics & vets" with `Stethoscope` icon in the Manage section

### Integrations
- **`components/cats/cat-detail.tsx`** — `<VetVisitsCard>` added between `<HealthTicketsCard>` and `<BreedingCard>`
- **`components/health/health-ticket-modal.tsx`**:
  - `EventRow` type extended with `vet_referral` event type and `linked_visit` field
  - Event thread renders `vet_referral` events with a cyan-bordered visit summary card showing: date, clinic, doctor, diagnosis, cost
- **`lib/storage/upload.ts`** — added `'lab-results'` bucket to the type union; `uploadImage` auto-passes through PDFs unmodified (only images get compressed)

---

## Migration

```bash
supabase db push
# Then regenerate types
supabase gen types typescript --local > lib/supabase/types.ts
```

After regen, uncomment the Phase 10 aliases in `lib/supabase/aliases.ts`:
```ts
export type Clinic              = Database['public']['Tables']['clinics']['Row']
export type Doctor              = Database['public']['Tables']['doctors']['Row']
export type VetVisit            = Database['public']['Tables']['vet_visits']['Row']
export type VetVisitMedicine    = Database['public']['Tables']['vet_visit_medicines']['Row']
export type LabResult           = Database['public']['Tables']['lab_results']['Row']
export type DoctorSpecialisation = Database['public']['Enums']['doctor_specialisation']
export type VetVisitType        = Database['public']['Enums']['vet_visit_type']
export type VetVisitStatus      = Database['public']['Enums']['vet_visit_status']
export type LabResultFileType   = Database['public']['Enums']['lab_result_file_type']
```

Then remove the `(supabase as any)` casts in all `/api/clinics/*`, `/api/doctors/*`, `/api/cats/[id]/vet-visits`, `/api/vet-visits/*`, `/api/lab-results/*` routes.

---

## Files Added / Modified

### New files
- `supabase/migrations/20260422000000_phase10_vet_medical.sql`
- `lib/schemas/vet.ts`
- `app/api/clinics/route.ts`
- `app/api/clinics/[id]/route.ts`
- `app/api/doctors/route.ts`
- `app/api/doctors/[id]/route.ts`
- `app/api/cats/[id]/vet-visits/route.ts`
- `app/api/vet-visits/[id]/route.ts`
- `app/api/vet-visits/[id]/lab-results/route.ts`
- `app/api/lab-results/[id]/route.ts`
- `components/vet/clinics-client.tsx`
- `components/vet/clinic-modal.tsx`
- `components/vet/doctor-modal.tsx`
- `components/vet/vet-visits-card.tsx`
- `components/vet/vet-visit-modal.tsx`
- `app/(app)/clinics/page.tsx`
- `docs/phases/phase-10-handoff.md`

### Modified
- `lib/storage/upload.ts` — added `lab-results` bucket
- `lib/schemas/health-tickets.ts` — added `vet_referral` to event type enum
- `lib/supabase/aliases.ts` — added commented Phase 10 type aliases
- `app/api/health-tickets/[id]/route.ts` — GET now joins `linked_visit` via `linked_vet_visit_id` FK
- `components/health/health-ticket-modal.tsx` — `EventRow` includes `vet_referral`; renders linked visit card
- `components/cats/cat-detail.tsx` — `<VetVisitsCard>` integration
- `components/app/admin-sidebar.tsx` — added "Clinics & vets" nav item
- `messages/en.json`, `messages/id.json` — added `vet` section + `eventTypes.vet_referral` + `nav.clinics`

---

## Notes for Next Agent

### Key patterns from Phase 10
- **Cascading select** (`vet-visit-modal.tsx`): clinic dropdown fetches full clinic list with embedded doctors, then doctor selector filters client-side. Avoids a second fetch round-trip.
- **Optional ticket linking** (`vet-visit-modal.tsx`): the ticket selector only appears when the cat has at least one non-resolved ticket. When the user picks one, the `POST /api/cats/[id]/vet-visits` route has a side-effect to insert a `vet_referral` event — replicate this pattern for any "link X to ticket" flow.
- **Ticket thread rendering** (`health-ticket-modal.tsx`): the `vet_referral` event type has a dedicated card branch in the event `.map()`. If you add more event types, follow the same pattern.
- **Generic file uploads in existing `uploadImage` helper**: the function already checks `file.type.startsWith('image/')` and only compresses images — PDFs pass through unmodified. Reuse for any non-image upload.

### Deferred / not built
- **Financial auto-transactions** from `visit_cost` / `transport_cost` — waits for Phase 11 (Finance)
- **Follow-up push notifications** — waits for notification infra
- **Symptom tag list** (admin-configurable) — spec calls for it but deferred to Polish phase
- **Stock linking on medicines** — waits for Stock phase
- **Blood test OCR** — explicitly deferred per spec §4.3

### Next work
Per the user's latest spec-reorder request:
- **Phase 11** is now **Reports** (was §13)
- **Phase 12** is now **Polish** (was §15)
- Plus several non-phase fixes: batch cat-sitter assignment, admin stop/delete medication plan, sitter edit/delete own weight logs, room capacity excludes deceased/sold
