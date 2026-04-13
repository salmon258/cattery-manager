# Cattery Management System — Full Product Specification

**Stack:** Next.js 14 (App Router) + Supabase (PostgreSQL + Auth + Storage + Realtime)
**Deployment:** Vercel (Next.js) + Supabase Cloud
**PWA:** next-pwa with service worker, offline support for read views, installable on iOS/Android/desktop
**Scope:** Single cattery, multi-role (Admin / Cat Sitter)

---

## 1. Architecture Overview

### 1.1 Tech Stack Detail
| Layer | Choice |
|---|---|
| Frontend | Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes + Supabase Edge Functions for scheduled jobs |
| Database | Supabase PostgreSQL with Row Level Security (RLS) |
| Auth | Supabase Auth (email/password, session-based) |
| File Storage | Supabase Storage (cat photos, weight images) |
| Push Notifications | Web Push API via service worker (PWA) |
| Scheduling / Reminders | Supabase Edge Functions + pg_cron for scheduled tasks |
| PWA | next-pwa, manifest.json, offline caching for cat list & reports |
| i18n | `next-intl` — English (default) + Bahasa Malaysia |
| Theme | `next-themes` — dark/light following device `prefers-color-scheme` |
| Data Fetching | TanStack React Query v5 — all server state, loading/error/refetch |
| Form Validation | Zod schemas + React Hook Form |
| Mobile Sheets | shadcn/ui `<Drawer>` (Vaul-based) — replaces all modals on mobile |

### 1.2 Role System
| Role | Permissions |
|---|---|
| **Admin** | Full CRUD on all entities, user management, admin panel, all reports, system settings, salary management |
| **Cat Sitter** | View cats, submit weight/eating/medicine/vitamin logs, mark medication schedule ticks, report health issues, view own payroll history only |

All access enforced via Supabase RLS policies — not just UI gating.

---

## 2. Cross-Cutting UI/UX Standards

These rules apply globally across the entire app.

### 2.1 Internationalisation (i18n)

- **Library:** `next-intl`
- **Languages supported:** English (`en`), Bahasa Malaysia (`ms`)
- **Default:** English
- **Language detection order:**
  1. User's saved preference in `profiles.preferred_language` (if set)
  2. Browser/device `Accept-Language` header
  3. Fallback: `en`
- **Language switcher:** available in the user profile menu (top-right); saves to `profiles.preferred_language`
- All UI strings, labels, error messages, and toast notifications are translated
- Date/time formatting follows locale conventions (e.g. `dd/MM/yyyy` for `ms`)
- Translation files: `/messages/en.json` and `/messages/ms.json`
- Nutrition/calorie labels, food categories, symptom tags — all translatable
- Admin-defined content (food item names, room names, etc.) is stored as entered — not auto-translated

### 2.2 Dark Mode / Light Mode

- **Library:** `next-themes` with `attribute="class"` strategy
- **Default:** follows device `prefers-color-scheme` media query automatically
- **Override:** user can manually set Light / Dark / System in their profile settings; saved to `profiles.theme_preference`
- Tailwind CSS `dark:` variants used throughout for all color tokens
- shadcn/ui components support dark mode natively
- Charts (Recharts or Chart.js): use theme-aware color palettes via CSS variables
- Images and file previews: no inversion — always rendered as-is

### 2.3 Modal vs Sheet (Mobile-first UI Pattern)

All overlay UI (forms, confirmations, detail views, pickers) follows this rule:

| Breakpoint | Component |
|---|---|
| Desktop (`md` and above) | shadcn/ui `<Dialog>` (standard modal) |
| Mobile (below `md`) | shadcn/ui `<Drawer>` (bottom sheet, Vaul-based) |

**Sheet behaviour requirements:**
- Title and close button (`×`) fixed at the top of the sheet — do not scroll away
- Sheet content area is independently scrollable
- Sheet slides up from the bottom; dismiss by swipe-down or close button
- No drag handle repositioning that obscures the title
- Sheet max-height: 90vh; min-height determined by content
- Nested sheets not permitted — if a sheet needs a sub-action, use an inline section or navigate to a new page

**Implementation pattern:**
```tsx
// Use a single responsive wrapper component:
<ResponsiveModal> — renders <Dialog> on desktop, <Drawer> on mobile
```
Build a shared `<ResponsiveModal title="..." onClose={...}>` component used everywhere.

### 2.4 React Query: Data Fetching Standards

- All server state managed via **TanStack React Query v5**
- Every data-fetching hook follows the pattern:
  - `useQuery` for reads (with `queryKey`, `queryFn`, `staleTime`)
  - `useMutation` for writes (with `onSuccess` → `queryClient.invalidateQueries`)
- **Loading state:** skeleton loaders shown (not spinners) for list/table views; inline spinner for buttons
- **Error state:** error banner with retry button for page-level failures; toast for mutation failures
- **Refetch:** pull-to-refresh on mobile list views triggers `refetch()`; stale data refetched on window focus
- Query keys follow a consistent namespace: `['cats']`, `['cats', catId]`, `['eating-logs', catId]`, etc.
- Optimistic updates used for: medication task ticks, health ticket status changes

### 2.5 Zod: Form Validation Standards

- Every form has a corresponding **Zod schema** defined in `/lib/schemas/`
- React Hook Form `useForm` always uses `zodResolver(schema)`
- Validation errors shown inline below each field (not toast)
- Required fields, max lengths, numeric ranges, date constraints all defined in schema
- Shared schemas reused across create/edit forms (with `.partial()` for edit variants)
- Server-side API routes also validate incoming bodies with the same Zod schemas

### 2.6 Mobile Viewport Rules

The following meta tags and CSS rules are applied globally on mobile to prevent user-initiated zoom and horizontal scroll:

```html
<!-- _document.tsx / layout.tsx -->
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
```

```css
/* globals.css */
html, body {
  overflow-x: hidden;
  touch-action: pan-y; /* vertical scroll only, no pinch-zoom */
}
```

- Horizontal scroll (`overflow-x`) disabled on all pages and sheets
- Pinch-to-zoom disabled via `touch-action: pan-y` and viewport meta
- These rules apply inside sheets/drawers as well — the sheet content wrapper also sets `overflow-x: hidden`
- Input fields use `font-size: 16px` minimum to prevent iOS auto-zoom on focus



---

## 2. Authentication & Account Management

### 2.1 Auth Flow
- Email + password login (no public self-registration — Admin creates all accounts)
- JWT session managed by Supabase Auth
- Persistent login with refresh token (PWA-friendly)
- Force logout / session revoke by Admin

### 2.2 User Profiles
Each user has a `profiles` table row linked to `auth.users`:
- `id`, `full_name`, `role` (admin | cat_sitter), `avatar_url`, `is_active`, `created_at`, `last_login_at`

### 2.3 Admin: User Management Panel
- **Create account:** full name, email, temporary password, role assignment
- **Edit account:** change name, reset password (sends reset email or sets directly), change role
- **Deactivate / ban account:** sets `is_active = false`; user cannot log in; session revoked immediately via Supabase Auth admin API
- **Reactivate account**
- **View last login timestamp**

---

## 3. Cat Management System

### 3.1 Cat Profile (CRUD)

**Fields:**
- `name` (required)
- `photos` — multiple images, stored in Supabase Storage; first image = profile photo
- `pedigree_photo_url` — single pedigree certificate image upload (optional), stored separately from general photos; displayed in its own "Pedigree" section on the cat profile
- `date_of_birth` (required)
- `gender` (Male / Female)
- `breed` (free text or dropdown, admin-configurable list)
- `microchip_number` (optional)
- `registration_number` (optional, e.g. TICA/CFA)
- `color_pattern` (free text)
- `status` — Active, Retired, Deceased, Sold
- `assignee_id` — FK to `profiles` (cat_sitter role); the primary responsible cat sitter for this cat (optional, set by Admin only)
- `notes` (rich text)
- `created_at`, `updated_at`, `created_by`

**Soft delete** — cats are never hard-deleted; status set to Deceased/Sold with date.

---

### 3.2 Breeding Module

#### 3.2.1 Mating Program
- Create a **mating record** linking one male cat + one female cat
- Fields: `male_cat_id`, `female_cat_id`, `mating_date`, `mating_method` (natural | AI), `notes`, `created_by`
- Automatically calculates and stores **expected labor date** = mating_date + 63 days (configurable gestation days in system settings)
- Status: Planned → Confirmed → Pregnant → Delivered → Failed

#### 3.2.2 Breeding Calendar
- Calendar view (monthly) showing:
  - Mating dates
  - Expected labor dates
  - Heat cycle dates (from heat log)
- Click any event to see full details
- **Add to Calendar** button — generates `.ics` file download for each event (compatible with Apple Calendar, Google Calendar)
- **Push notification reminder** — configurable days before expected labor (e.g. 7 days, 3 days, 1 day before)

#### 3.2.3 Kitten Registration
- From a mating record (once status = Delivered), Admin can add a **litter**:
  - `litter_date` (actual birth date, auto-filled from today, editable)
  - `litter_size` (number born, number survived)
  - Add individual kittens: each kitten auto-creates a new Cat Profile with:
    - `date_of_birth` = litter date (auto-filled)
    - `father_id` = male cat from mating
    - `mother_id` = female cat from mating
    - Name, gender, color (filled manually)
- Parent-child relationship stored in `cat_lineage` table: `kitten_id`, `mother_id`, `father_id`, `litter_id`
- Cat profile page shows lineage tree (parents + siblings + offspring)

#### 3.2.4 Heat Cycle Logging
- Cat Sitter or Admin can log a heat event for a female cat
- Fields: `cat_id`, `observed_date`, `intensity` (mild | moderate | strong), `notes`, `logged_by`
- **Admin Reporting:**
  - Per-cat heat history table
  - Average cycle interval calculation
  - Chart: heat frequency over time per cat
  - Export CSV

---

### 3.3 Weight Tracking

- Submit weight record per cat
- Fields: `cat_id`, `weight_kg` (decimal), `recorded_at` (auto = now, editable by admin), `photo_url` (optional image upload), `notes`, `submitted_by`
- **Admin Reports:**
  - Weight history table per cat
  - Line chart: weight over time (per cat or multi-cat overlay)
  - Filter by date range
  - Flag if weight drops >10% from previous record (configurable threshold)
  - Export CSV

---

### 3.4 Eating Report

#### 3.4.1 Food Item Catalogue (Admin)

Admin manages the food catalogue used in eating reports. Each item now includes calorie data:

**Food item fields:**
- `name` (required)
- `brand` (optional)
- `type` — Wet Food | Dry Food | Raw | Treat | Supplement | Other
- `calories_per_gram` — decimal (kcal/g); required for calorie tracking; Admin sets this per item
- `unit` — g | ml | sachet | piece (for display purposes)
- `notes`
- `is_active`

Admin can update `calories_per_gram` at any time. Historical eating logs retain the calorie value **at the time of submission** (snapshotted — see below).

#### 3.4.2 Recommended Daily Calorie Intake (Per Cat)

Calculated automatically from the cat's **latest weight submission**:

**Formula (Resting Energy Requirement — standard feline RER):**
```
RER (kcal/day) = 70 × (weight_kg ^ 0.75)
```
**Maintenance Energy Requirement (MER)** applies a multiplier based on life stage / condition (admin-configurable per cat):

| Life Stage / Condition | Multiplier |
|---|---|
| Neutered adult | 1.2 |
| Intact adult | 1.4 |
| Kitten (< 6 months) | 2.5 |
| Kitten (6–12 months) | 2.0 |
| Pregnant | 1.6 |
| Lactating | 2.0 |
| Overweight (target loss) | 0.8 |
| Underweight (target gain) | 1.4 |

- **`life_stage_multiplier`** stored on the `cats` table; Admin sets it per cat; defaults to 1.2 (neutered adult)
- **Recommended daily kcal** = RER × multiplier
- Recalculated automatically whenever a new weight log is submitted
- Displayed prominently on cat profile Overview tab and at the top of the eating log form

#### 3.4.3 Submitting an Eating Report

One eating report = one **meal session** for one cat. A single meal can involve multiple food items (e.g. wet food + dry food together).

**Meal-level fields:**
- `cat_id` (required)
- `meal_time` (auto = now, editable)
- `feeding_method` — **Ate by itself** | **With assistance** | **Force fed** (required)
- `notes` (optional free text)
- `submitted_by`

**Per food item (repeatable rows — at least 1 required):**
- `food_item_id` — dropdown from active food catalogue
- `quantity_given_g` — weight in grams given (required for calorie calculation)
- `quantity_eaten` — **All** | **Most** | **Half** | **Little** | **None** (how much was actually consumed)
- `calories_per_gram_snapshot` — auto-copied from `food_items.calories_per_gram` at submission time (immutable after save)
- `estimated_kcal_consumed` — calculated: `quantity_given_g × estimated_eaten_ratio × calories_per_gram_snapshot`
  - Eaten ratio mapping: All = 1.0, Most = 0.75, Half = 0.5, Little = 0.2, None = 0.0

**Total meal kcal** = sum of `estimated_kcal_consumed` across all food rows in the session.

**DB tables:**
```
eating_logs       — one row per meal session (meal-level fields)
eating_log_items  — one row per food item per session (FK to eating_logs)
```

#### 3.4.4 Calorie Summary & Reporting

**Cat profile — daily calorie view:**
- Shows today's total kcal consumed vs recommended daily kcal
- Progress bar: green (on track) / amber (>20% under) / red (>50% under or force fed)
- Last 7 days calorie chart (bar chart: actual vs target per day)

**Admin reports:**
- All eating logs filterable by cat / food type / feeding method / date
- Appetite trend per cat: quantity eaten ratio over time
- Calorie intake trend per cat: daily kcal vs recommended over selected period
- Force-fed incidents log (filterable — useful for health monitoring)
- Export CSV (includes kcal columns)

---

### 3.5 Medicine & Vitamin Log

#### 3.5.1 Ad Hoc Submission
- Cat Sitter or Admin can log a one-off medicine/vitamin given
- Fields: `cat_id`, `medicine_name` (free text or from stock), `dose`, `unit`, `given_at` (auto = now), `route` (oral | topical | injection), `notes`, `submitted_by`

#### 3.5.2 Scheduled Medication (Admin-set)
- Admin creates a **medication schedule** for a cat:
  - `cat_id`, `medicine_name`, `dose`, `unit`, `route`
  - `start_date`, `end_date`
  - `frequency`: X times per day, on specific days of week, or interval-based (e.g. every 3 days)
  - System auto-generates individual **medication tasks** from the schedule
- Cat Sitter sees a **daily task list** — pending medication tasks for today
  - Each task shows: cat name, medicine, dose, time due
  - Tick to confirm → logs `confirmed_at`, `confirmed_by`
  - Overdue tasks (not ticked past due time) highlighted in red
- Admin dashboard shows:
  - Compliance rate per cat / per medication
  - Missed dose log
  - Full medication history

---

### 3.6 Vaccination Records & Reminders

- Per cat vaccination log
- Supported vaccines: F3, F4, Rabies — plus custom (admin-configurable)
- Fields: `cat_id`, `vaccine_type`, `administered_date`, `batch_number` (optional), `administered_by_vet` (text), `next_due_date` (auto-calculated from vaccine type config, editable), `notes`, `recorded_by`
- **Reminder system:**
  - Push notification + in-app alert X days before `next_due_date` (configurable per vaccine type, default 14 days)
  - Admin sees upcoming vaccinations dashboard widget
  - Overdue vaccinations flagged in red on cat profile

---

### 3.7 Deworming & Flea Treatment Records & Reminders

- Per cat treatment log
- Type: Deworming | Flea Treatment | Combined
- Fields: `cat_id`, `treatment_type`, `product_name`, `administered_date`, `next_due_date` (auto-calculated, configurable interval e.g. 3 months), `notes`, `recorded_by`
- Same reminder system as vaccinations (push + in-app)
- History table on cat profile

---

## 4. Vet & Doctor Tracking

### 4.1 Vet / Clinic Directory (Admin CRUD)
A reusable directory of vets and clinics referenced by visit records.

**Clinic fields:**
- `name`, `address`, `phone`, `email`, `website`, `notes`, `is_active`

**Doctor fields:**
- `full_name`, `clinic_id` (FK), `specialisation` (general | dermatology | cardiology | oncology | other), `phone`, `notes`, `is_active`
- A doctor can belong to one clinic; a clinic can have multiple doctors

---

### 4.2 Vet Visit Record

Admin or Cat Sitter can create a vet visit record per cat.

**Fields:**
- `cat_id`
- `visit_date` + `visit_time` (auto = now, editable)
- `clinic_id` (dropdown from directory)
- `doctor_id` (dropdown filtered by selected clinic)
- `visit_type` — Routine Checkup | Emergency | Follow-up | Vaccination | Surgery | Dental | Other
- `chief_complaint` — short text: main reason for visit
- `symptoms` — multi-select or free text: lethargy, vomiting, diarrhea, loss of appetite, sneezing, discharge, weight loss, skin issues, other (comma-separated tags, admin-configurable list)
- `diagnosis` — text (filled after visit)
- `treatment_performed` — text (e.g. wound cleaning, IV drip, x-ray)
- `medicines_prescribed` — repeatable rows: `medicine_name`, `dose`, `frequency`, `duration`, `notes`
  - Optionally link to stock item if medicine is in stock
- `follow_up_date` (optional) — triggers reminder notification
- `visit_cost` — decimal; automatically creates a financial transaction (see Section 6)
- `transport_cost` — decimal; separately tracked, also auto-creates a financial transaction
- `notes` — rich text
- `created_by`, `created_at`

**Status:** Scheduled → In Progress → Completed → Cancelled

---

### 4.3 Blood Test Result — Upload & Storage

Each vet visit can have **one or more lab result attachments**. OCR/auto-extraction is deferred to a later phase — for now, files are uploaded and stored only.

**Upload flow:**
1. User uploads PDF or image (JPG/PNG) of blood test result from the vet visit record
2. Multiple files allowed per visit (e.g. CBC + biochemistry panel as separate PDFs)
3. File stored in Supabase Storage under `lab_results/{visit_id}/{filename}`
4. Record saved to `lab_results` table with file metadata

**Lab Result record fields:**
- `id`, `vet_visit_id` (FK), `file_url`, `file_type` (pdf | image), `file_name`, `file_size_bytes`, `notes` (free text, e.g. "CBC panel 12 April"), `uploaded_by`, `uploaded_at`

**Viewing:**
- On the vet visit record, lab result attachments listed as downloadable/viewable cards
- PDF opens in browser viewer; images open in lightbox
- On cat profile "Vet History" tab, each visit card shows a paperclip icon if lab results are attached

> 📌 **Future phase:** Auto-extraction of blood marker values via Claude API OCR, structured storage per marker, trend charts across visits.

---

### 4.4 Vet Visit — Cat Profile Integration
- Cat profile page gets a new **"Vet History"** tab
- Shows all visits in reverse-chronological order
- Each visit card: date, clinic, doctor, visit type, diagnosis summary, cost
- Expand to see full detail + lab results
- Overdue follow-ups (follow_up_date passed, no follow-up visit logged) flagged in red

### 4.5 Vet Reminders
- Push notification + in-app alert on `follow_up_date` (configurable lead: same day or 1 day before)
- Admin dashboard widget: upcoming follow-ups in next 14 days

---

## 5. Stock Management System

> 📌 **Deferred to a later phase.** Full spec preserved below for reference when ready to build.

The stock system covers item catalogue CRUD, a ledger-based stock-in/stock-out model with FIFO expiry batch tracking, low stock alerts, expiry warnings, and stock movement reports. See the original spec detail for full field definitions.

**Tables to be added in this phase:**
```
stock_items      — item catalogue (name, category, brand, unit, min_threshold)
stock_movements  — all in/out transactions with batch/expiry tracking
```

---

## 6. Cat Health Ticket System

A ticket-based sickness tracking system that follows a cat's health episode from first observation through to resolution — across multiple updates, vet visits, and medication rounds, all under one unified thread.

### 6.1 Concept: Health Ticket

A **health ticket** represents a single health episode for a cat (e.g. "Respiratory infection — April 2026"). It is opened by a Cat Sitter when they notice something wrong, and stays open until an Admin or Cat Sitter marks it resolved. Everything related to that episode — observations, vet visits, prescribed medications — is linked to the ticket.

**Ticket lifecycle:**
```
Reported → Under Observation → Referred to Vet → Receiving Treatment → Resolved
```
Any stage can loop back (e.g. Receiving Treatment → Referred to Vet for a follow-up visit). The ticket is never force-closed; only explicitly marked Resolved.

---

### 6.2 Opening a Ticket (Cat Sitter or Admin)

**Fields:**
- `cat_id` (required)
- `title` — short description e.g. "Sneezing + discharge, lethargic since yesterday"
- `description` — free text, detailed observation
- `symptoms` — multi-select tags (same admin-configurable list as vet visits): lethargy, vomiting, diarrhea, loss of appetite, sneezing, nasal discharge, eye discharge, weight loss, skin issues, limping, other
- `photos` — up to 5 images (e.g. photo of wound, discharge, swelling) stored in Supabase Storage
- `severity` — Mild | Moderate | Severe (Cat Sitter's assessment)
- `observed_at` (auto = now, editable)
- `reported_by`

On creation: ticket status = **Reported**, notification sent to Admin.

---

### 6.3 Ticket Updates (Activity Thread)

Each ticket has a chronological **activity thread** — every action appended as a new entry, never editing history. Anyone can add an update at any time.

**Update types:**

| Type | Who | What it captures |
|---|---|---|
| `observation` | Cat Sitter / Admin | New symptom notes, photos, free text update |
| `status_change` | Admin | Move ticket to next stage with optional note |
| `vet_referral` | Admin | Link an existing vet visit record to this ticket |
| `medication_added` | Admin | Add a medication entry to this ticket (see 6.4) |
| `medication_log` | Cat Sitter / Admin | Tick that a medicine was given (linked to medication entry) |
| `resolved` | Admin | Mark ticket closed with resolution summary |
| `reopened` | Admin | Re-open a resolved ticket if condition recurs |

Each update entry: `id`, `ticket_id`, `type`, `content` (text), `photos` (optional array), `linked_record_id` (optional FK for vet_visit or medication), `created_by`, `created_at`

---

### 6.4 Medication Within a Ticket

Admin can add one or more **medication entries** directly inside a ticket (separate from the general scheduled medication system in §3.5 — this is episode-specific):

**Medication entry fields:**
- `ticket_id`, `medicine_name`, `dose`, `unit`, `route` (oral | topical | injection), `frequency`, `start_date`, `end_date`, `notes`

Cat Sitter sees these as **tick tasks** in their daily task list (same UI as §3.5 scheduled meds), tagged with the ticket title so they know the context. Ticking logs a `medication_log` update on the ticket thread.

Ticket medication tasks disappear from the task list once the ticket is Resolved or the `end_date` passes.

---

### 6.5 Vet Visit Linking

When a vet visit is created (§4.2) for a cat that has an open health ticket, the system:
1. Prompts: "Link this visit to an open health ticket?" with a dropdown of the cat's open tickets
2. If linked: creates a `vet_referral` update entry on the ticket thread with visit summary (date, clinic, diagnosis, cost)
3. A vet visit can be linked to at most one ticket; a ticket can have multiple vet visits

This gives the full picture on one screen: Cat Sitter reports sneezing → Admin opens vet visit → Cat goes to clinic → follow-up visit 1 week later → all visible on the same ticket thread.

---

### 6.6 Ticket Resolution

Admin marks ticket **Resolved** with:
- `resolution_summary` — what was the outcome / treatment that worked
- `resolved_at` (auto = now)
- `resolved_by`

On resolution:
- All open medication tasks for this ticket are deactivated
- Cat's active ticket count on profile decrements
- Ticket archived (still fully viewable on cat profile)

---

### 6.7 Ticket Views

**Cat Sitter view:**
- "My Cats' Active Tickets" widget on dashboard: list of open tickets for assigned cats, sorted by severity then age
- Can view all cats' open tickets
- Can open new tickets and add observation updates
- Cannot change ticket status (except via resolution — Admin only)

**Admin view:**
- All open tickets across all cats, filterable by status / severity / cat / date
- Dashboard widget: count of open tickets by severity (Mild / Moderate / Severe)
- Full ticket history per cat on the cat profile "Health Tickets" tab

**Cat profile "Health Tickets" tab:**
- Open tickets at top (sorted by severity)
- Resolved tickets below (collapsible, sorted by date)
- Each ticket card: title, severity badge, status badge, open date, last updated, linked vet visits count

---

### 6.8 Health Ticket DB Tables
```
health_tickets        — one per health episode per cat
ticket_updates        — activity thread entries (observations, status changes, vet links, med logs)
ticket_medications    — episode-specific medication entries linked to a ticket
ticket_photos         — photos attached to ticket or update entries
```

---

## 7. Room Management System

### 7.1 Room Directory (Admin CRUD)

Admin defines the physical rooms / spaces in the cattery.

**Room fields:**
- `name` (required) — e.g. "Breeding Room A", "Kitten Ward", "Quarantine Room 1", "Free Roam Area"
- `type` — Breeding | Kitten | Quarantine | General | Isolation | Other
- `capacity` — max number of cats (optional, informational)
- `description` — notes (e.g. "Has AC, double-door entry")
- `is_active` — soft-delete
- `created_at`, `created_by`

---

### 7.2 Cat Room Assignment

**Current room** is stored on the `cats` table as `current_room_id` (FK to rooms, nullable).

**Assignment rules:**
- Admin can assign or move any cat to any room
- Cat Sitters cannot reassign rooms — read-only for them
- A cat can be unassigned (no room) — shown as "Unassigned" in UI
- Multiple cats can share one room (no hard limit enforced in DB, but capacity shown as a soft warning)

---

### 7.3 Room Movement Log

Every time a cat's room changes, a log entry is created automatically — never manually.

**`room_movements` table fields:**
- `id`, `cat_id`, `from_room_id` (nullable — null if previously unassigned), `to_room_id` (nullable — null if moved to unassigned), `moved_at` (auto = now), `moved_by` (FK profiles), `reason` (optional free text)

**This is append-only** — past movements are never edited or deleted.

---

### 7.4 Room Views

**Room overview page (Admin):**
- Grid or list of all active rooms
- Each room card: name, type, current occupants (cat avatars + names), capacity indicator (e.g. 3/5)
- Click room → room detail: current cats list + full movement history for that room

**Move a cat (Admin only):**
- From cat profile: "Move Room" button → dropdown of available rooms → optional reason → confirm
- From room detail: drag cat or use "Transfer" button → select destination room

**Cat profile:**
- Shows current room prominently on Overview tab
- "Room History" section: chronological log of all room movements (date, from, to, moved by, reason)

**Cat Sitter view:**
- Can see which room each cat is in (read-only)
- Room is shown on cat cards in the cat list for quick orientation

---

### 7.5 Room DB Tables
```
rooms          — room directory
room_movements — append-only movement log
```
`cats.current_room_id` updated on each move.

---

## 8. Cat Assignee System

### 8.1 Assignment Model

Each cat has one **primary assignee** — a Cat Sitter who is primarily responsible for that cat's daily care. This is set by Admin on the cat profile (`assignee_id` field, see §3.1).

**Key rules:**
- Assignment is informational / organizational, not a permission gate
- Any Cat Sitter can submit any report (weight, eating, medication, health ticket update) for any cat — not just their assigned cats
- The assignee simply determines whose **personal to-do list** a cat appears on
- Admin can change assignment at any time
- A cat can be unassigned (no primary sitter)
- A Cat Sitter can be assigned multiple cats

---

### 8.2 Cat Sitter: My Cats Dashboard

The primary view for Cat Sitters is a **"My Cats"** dashboard showing only their assigned cats with all pending tasks.

**My Cats widgets (per assigned cat):**
- Cat avatar, name, current room
- Overdue or due-today tasks:
  - Medication tasks due today (from scheduled meds + ticket meds)
  - Active open health tickets with severity badge
  - Any overdue vaccination / deworming reminders
- Quick-action buttons (always visible per cat card):
  - **Log Weight** — opens weight entry sheet
  - **Log Meal** — opens eating report sheet
  - **Log Vitamin / Medication** — opens ad hoc medicine/vitamin log sheet (§3.5.1); pre-fills cat
  - **Report Issue** — opens new health ticket sheet

**"All Cats" view:**
- Full cat list, accessible to all Cat Sitters
- Shows all cats across all rooms
- Tasks and logs can be submitted for any cat here
- Visual indicator: assignee name shown on each cat card (so sitters know who's primarily responsible)

---

### 8.3 Admin: Assignee Management

- In user management panel, Admin can see each Cat Sitter's assigned cat count
- On cat profile, "Primary Assignee" field: searchable dropdown of active Cat Sitter accounts
- Bulk reassignment: if a Cat Sitter is deactivated, Admin is prompted to reassign their cats before deactivation completes
- Reports filterable by assignee (e.g. "show all eating logs submitted by Siti")

---

## 9. Financial Accounting

### 7.1 Overview
A simple income/expense ledger scoped to cattery operations. Not full double-entry bookkeeping — every transaction is one of: **Income** or **Expense**, with a category. The ledger is the source of truth; reports are derived from it.

---

### 7.2 Transaction Categories

**Expense categories (admin-configurable, defaults below):**
- Vet & Medical (auto-created from vet visit costs)
- Transport (auto-created from vet transport costs)
- Medicine & Vitamins
- Food & Supplies
- Stock / Inventory Purchase
- Grooming
- Staff Payroll (auto-created from payroll entries)
- Equipment
- Utilities
- Electricity
- Other Expense

**Income categories:**
- Adoption Fee (auto-created from adoption records)
- Kitten Sale
- Stud Fee
- Boarding Fee
- Other Income

---

### 7.3 Transaction Record

**Fields:**
- `type` — Income | Expense
- `category_id` (FK to transaction_categories)
- `amount` (decimal, always positive)
- `currency` (default from system settings, e.g. MYR)
- `transaction_date` (auto = today, editable)
- `description` — free text
- `reference_number` — invoice/receipt number (optional)
- `receipt_url` — upload receipt image or PDF (optional), stored in Supabase Storage
- `related_entity_type` — cat | vet_visit | adoption | stock_item | null (polymorphic link)
- `related_entity_id` — FK to the related record
- `payment_method` — Cash | Bank Transfer | Card | Other
- `recorded_by`, `created_at`

**Auto-created transactions (no manual entry needed):**
| Trigger | Type | Category | Amount source |
|---|---|---|---|
| Vet visit saved with `visit_cost` | Expense | Vet & Medical | `visit_cost` field |
| Vet visit saved with `transport_cost` | Expense | Transport | `transport_cost` field |
| Adoption record saved with `adoption_fee` | Income | Adoption Fee | `adoption_fee` field |
| Stock-in recorded with `cost_per_unit` | Expense | Stock / Inventory Purchase | qty × cost_per_unit |

Auto-created transactions are editable by Admin (in case of correction) but flagged as `auto_generated = true`.

---

### 9.4 Payroll & Salary

#### 9.4.1 Salary Definition (Admin)

Admin defines a base salary for each Cat Sitter on their user profile:

**`profile_salaries` table fields:**
- `profile_id` (FK to profiles, unique — one active salary per person)
- `monthly_salary` (decimal) — gross base salary
- `currency` (inherits system default)
- `effective_from` (date) — when this salary rate took effect
- `notes` (optional, e.g. "includes allowance")
- `created_by`, `created_at`

Multiple salary records per person are allowed (history preserved); only the record with the latest `effective_from` on or before today is the "active" salary. Admin can view the full salary history per person.

#### 9.4.2 Payroll Entry (Admin)

Admin records payroll payments. A payroll entry is linked to a Cat Sitter's profile and generates a financial transaction automatically.

**`payroll_entries` table fields:**
- `profile_id` (FK to profiles) — the Cat Sitter being paid
- `payroll_period_start`, `payroll_period_end` (date)
- `gross_amount` (decimal) — defaults to the active `monthly_salary` for that period, editable
- `deductions` (decimal, optional) — e.g. advances, absences
- `net_amount` — auto-calculated: `gross_amount − deductions`
- `payment_date`
- `payment_method` — Cash | Bank Transfer | Other
- `transfer_proof_url` — upload image or PDF of bank transfer receipt / proof of payment; stored in Supabase Storage (optional but recommended)
- `notes`
- `created_by`, `created_at`

On save: auto-creates a `financial_transactions` row (Expense → Staff Payroll, amount = `net_amount`), linked via `related_entity_type = 'payroll'`.

#### 9.4.3 Cat Sitter: Payroll History View

Cat Sitters have access to a **"My Payroll"** page in their navigation — visible only to themselves, not to other Cat Sitters.

**What Cat Sitters can see on My Payroll:**
- Their own active monthly salary (current rate)
- List of all their payroll entries: period | gross | deductions | net | payment date | payment method
- **Transfer proof:** if Admin uploaded a proof, Cat Sitter can tap to view/download the image or PDF
- Status badge per entry: Paid (has payment_date) | Pending

**What Cat Sitters cannot see:**
- Other Cat Sitters' salaries or payroll records
- Admin financial ledger
- Total payroll cost figures

**RLS enforcement:** `payroll_entries` SELECT policy — Cat Sitters can only query rows where `profile_id = auth.uid()`. `profile_salaries` SELECT policy — same restriction.

#### 9.4.4 Admin: Payroll Management

- Full list of all payroll entries across all staff, filterable by person / period / status
- "New Payroll Entry" form: select Cat Sitter → period auto-fills current month → gross pre-fills from active salary → enter deductions → upload transfer proof → save
- View salary history per Cat Sitter (all historical rates)
- Edit salary: creates a new `profile_salaries` row (does not overwrite history)
- Payroll summary report: total payroll cost per period, per person breakdown (see §11.2)



### 7.5 Financial Reports (Admin only)

All reports filterable by date range and category.

**1. Income & Expense Summary**
- Total income vs total expense vs net for selected period
- Breakdown bar chart by category
- Month-over-month trend line chart

**2. Full Transaction Ledger**
- Paginated table: date | type | category | description | amount | payment method | recorded by
- Filters: type, category, date range, payment method
- Search by description or reference number
- Export CSV

**3. Expense Breakdown**
- Pie/donut chart: expense by category for selected period
- Table: category | total amount | % of total expenses

**4. Income Breakdown**
- Pie/donut chart: income by category
- Table: category | total amount | % of total income

**5. Vet Cost Report**
- Per-cat vet spending over time
- Total vet + transport costs for selected period
- Most visited clinic / most expensive visits

**6. Payroll Summary**
- Total payroll per period
- Per-payee payment history

**Export:** All reports exportable as CSV; summary reports printable as PDF (using browser print).

---

## 10. Adoption Management

### 8.1 Adopter Profile

Admin creates an adopter record at time of adoption.

**Fields:**
- `full_name` (required)
- `phone` (required)
- `email` (optional)
- `address` (optional)
- `id_type` — IC | Passport | Other (optional, for record-keeping)
- `id_number` (optional)
- `photos` — upload 1 or more photos (e.g. photo with the cat, ID photo) stored in Supabase Storage
- `notes` — free text (e.g. home environment, other pets, experience with cats)
- `created_by`, `created_at`

---

### 8.2 Adoption Record

One adoption record per cat (one-to-one, since re-adoption is not supported).

**Fields:**
- `cat_id` (FK, unique — one adoption per cat)
- `adopter_id` (FK to adopters)
- `adoption_date` (required)
- `adoption_fee` (decimal) — auto-creates an Income transaction (Adoption Fee category)
- `payment_method` — Cash | Bank Transfer | Card | Other
- `contract_url` — upload signed adoption contract PDF (optional)
- `description` — notes about the adoption (e.g. special conditions, trial period)
- `status` — Pending | Completed | Cancelled
- `created_by`, `created_at`

On adoption record status → Completed:
- Cat's status automatically set to **Sold**
- Cat removed from active daily task lists (medication, eating, weight)
- Financial income transaction auto-created

On Cancelled:
- Cat status reverts to Active
- Auto-created financial transaction voided (soft-deleted with `voided = true`)

---

### 8.3 Adoption UI

**Adopt a Cat flow (Admin only):**
1. Open cat profile → click "Record Adoption"
2. Create or search existing adopter (in case adopter has adopted before, their profile is reusable for reference)
3. Fill adoption details + fee + upload contract
4. Confirm → cat status updates, financial entry created

**Adopter directory:**
- Searchable list of all adopters (name, phone, adoption date, which cat)
- View adopter profile: photo, contact info, notes, their adopted cat (link to cat profile)
- Admin can edit adopter details post-adoption

**Adoption history on cat profile:**
- "Vet History" tab neighboured by "Adoption" tab
- Shows: adopter name (masked phone for privacy in list view), adoption date, fee paid, contract link

---

### 8.4 Adoption Reports (Admin)
- Total adoptions by month / year (bar chart)
- Total adoption income for period
- List of all adoptions: cat | adopter | date | fee | payment method
- Export CSV

---

## 11. Admin Centre

### 11.1 Dashboard (Admin Home)
Widgets:
- Cats overview: total active cats, count by gender/status
- Today's medication tasks (pending / done / overdue count)
- Open health tickets: count by severity (Mild / Moderate / Severe)
- Upcoming vaccinations (next 30 days)
- Upcoming deworming/flea treatments (next 30 days)
- Upcoming vet follow-ups (next 14 days)
- Stock warnings (expiring soon + low stock) *(deferred phase)*
- Recent activity feed (last 20 log entries across all modules)
- Upcoming breeding calendar events (next 2 weeks)
- Financial snapshot: this month's income vs expense vs net (mini bar chart)
- Recent adoptions (last 5)

### 11.2 Reporting Hub
All reports support:
- Date range filter
- Per-cat or all-cats view (where applicable)
- Export to CSV
- Print-friendly view

**Available reports:**
1. Eating logs — all cats, filterable by cat / food / date / assignee
2. Weight logs — all cats, with line chart per cat or multi-cat overlay
3. Medication compliance — schedule adherence per cat
4. Vaccination status — all cats, overdue highlighted
5. Heat cycle log — per cat history + frequency chart
6. Stock movement — full ledger *(deferred phase)*
7. Vet visit history — all cats or per cat, with costs
8. Health ticket report — open/resolved tickets, time-to-resolve, by cat/severity
9. Room occupancy log — movement history per room or per cat
10. Financial ledger — full income/expense with filters
11. Financial summary — income vs expense by category and period
12. Payroll summary — per payee, per period
13. Adoption report — total adoptions, income, cat list
14. User activity log — who submitted what, when (audit trail)

### 11.3 System Settings (Admin)
- Cattery name & logo (shown in PWA and header)
- Default currency
- Gestation period (days) — default 63
- Vaccination reminder lead times per vaccine type
- Deworming/flea reminder intervals
- Vet follow-up reminder lead time
- Low stock threshold defaults *(deferred phase)*
- Expiry warning lead days *(deferred phase)*
- Food item list management
- Breed list management
- Medicine/vitamin preset list management
- Symptom tag list management (for vet visits + health tickets)
- Transaction category management (income & expense)
- Notification preferences (push on/off per event type)

---

## 12. Notifications System

### 12.1 In-App Notifications
- Bell icon with unread count in navbar
- Notification types:
  - Upcoming vaccination due
  - Upcoming deworming/flea due
  - Expected labor approaching
  - Vet follow-up due
  - New health ticket opened (Admin)
  - Health ticket severity escalated (Admin)
  - Low stock alert *(deferred phase)*
  - Expiry warning *(deferred phase)*
  - Overdue medication task
- Mark as read / mark all as read

### 12.2 Push Notifications (PWA)
- Service worker handles Web Push
- Admin subscribes on first login (prompt)
- Cat Sitters receive: medication task reminders only
- Admins receive: all notification types
- Notification payload: title, body, deep-link URL to relevant record

---

## 13. PWA Configuration

- `manifest.json`: app name, icons (192px, 512px), theme color, `display: standalone`
- Service worker via `next-pwa`:
  - Cache: app shell, cat list, stock overview (stale-while-revalidate)
  - Offline page for unsupported routes
  - Background sync for medication tick submissions when offline (queued and replayed on reconnect)
- Installable on: iOS Safari (Add to Home Screen), Android Chrome, desktop Chrome/Edge
- Splash screens for iOS

---

## 14. Database Schema (Key Tables)

```
profiles              — user roles, assignee link, preferred_language, theme_preference
cats                  — cat profiles (assignee_id, current_room_id, pedigree_photo_url, life_stage_multiplier)
cat_photos            — cat image gallery (many-to-one cats)
cat_lineage           — parent-child relationships
mating_records        — breeding pairs + status
litters               — birth records linked to mating
heat_logs             — female cat heat observations
weight_logs           — per-cat weight entries
eating_logs           — one row per meal session (cat, time, feeding_method)
eating_log_items      — one row per food item per session (qty, eaten ratio, kcal snapshot)
food_items            — admin food catalogue (incl. calories_per_gram)
medication_schedules  — admin-set recurring medication plans
medication_tasks      — generated daily tasks from schedules
medication_logs       — ad hoc and confirmed task records
vaccination_records   — per-cat vaccine history
treatment_records     — deworming/flea history
health_tickets        — one per sickness episode per cat
ticket_updates        — activity thread entries per ticket
ticket_medications    — episode-specific meds linked to a ticket
ticket_photos         — photos on ticket or update entries
rooms                 — room directory
room_movements        — append-only room movement log
stock_items           — item catalogue (deferred phase)
stock_movements       — stock in/out ledger (deferred phase)
clinics               — vet clinic directory
doctors               — vet/doctor directory (linked to clinics)
vet_visits            — per-cat vet visit records (optional ticket link)
vet_medicines         — prescribed medicines rows per visit
lab_results           — blood test file upload records per vet visit
transaction_categories — income/expense category list
financial_transactions — full income/expense ledger
payroll_entries       — payroll payment records per staff member (with transfer_proof_url)
profile_salaries      — salary definition history per Cat Sitter profile
adopters              — adopter profiles
adoption_records      — one-to-one with cats
notifications         — in-app notification records
system_settings       — single-row config table
```

All tables include `created_at`, `updated_at`. Sensitive tables include `created_by` (FK to profiles).

RLS policies ensure Cat Sitters can only INSERT on log tables, SELECT on cats/stock — never DELETE or admin-level UPDATE.

---

## 15. UI/UX Notes

> Core UI standards (i18n, dark mode, sheets, React Query, Zod, viewport) are defined in **§2 Cross-Cutting UI/UX Standards** and apply to all modules below.

- **Mobile-first** responsive design — Cat Sitters primarily use on phone while handling cats
- Cat Sitter home: **"My Cats"** task dashboard as default landing page (assigned cats + their pending tasks)
- Admin view: full sidebar navigation with sections; Cat Sitter view: bottom tab bar (My Cats | All Cats | Tasks | My Payroll | Profile)
- Cat profile page: tabbed layout (Overview | Weight | Eating | Medication | Health Tickets | Vaccinations | Vet History | Breeding | Lineage | Room History | Adoption)
- Eating form: multi-row food item entry — "Add another food" button adds a new row; rows removable; total kcal shown live as user enters quantities
- Cat profile Overview: recommended daily kcal shown prominently with today's consumed kcal and a progress indicator
- Health ticket: threaded activity view similar to a support ticket — chronological, append-only
- Room overview: visual grid layout, cat avatars inside room cards
- Breeding calendar: full-page calendar component with color-coded event types
- Photo uploads: compressed client-side before upload (`browser-image-compression`)
- Date/time: always stored as UTC in DB, displayed in local timezone per device locale
- Financial pages: Admin-only, hidden entirely from Cat Sitter navigation

---

## 17. Money Lover Integration (Unofficial MCP)

> ⚠️ **Disclaimer:** This integration uses the unofficial Money Lover REST API via the community-built MCP server [`@ferdhika31/moneylover-mcp`](https://github.com/ferdhika31/moneylover-mcp). It is not endorsed by Money Lover / Finsify and may break without notice if they change their internal API. Build with this in mind — wrap every call in robust error handling and always treat Money Lover as a **best-effort sync**, never the source of truth. Your cattery's financial ledger in Supabase remains the source of truth.

---

### 14.1 Architecture: How It Fits In

The MCP server is a Node.js stdio process. Since your cattery app runs on Vercel (serverless), you **cannot** run a stdio MCP process directly in a Next.js API Route or Vercel Edge Function. Instead, the integration is handled by a **dedicated lightweight Node.js sync service** that runs alongside your app:

```
Cattery App (Next.js / Vercel)
        │
        │  writes financial_transactions to Supabase
        │
Supabase DB ──► Supabase Realtime / pg_cron
        │
        ▼
Money Lover Sync Service  (Node.js, always-on, e.g. Railway / Fly.io / your Mac Mini M4)
        │  uses @ferdhika31/moneylover-mcp as a library (not stdio)
        ▼
Money Lover API (connect.moneylover.me)
```

The sync service watches for new `financial_transactions` rows in Supabase (via Realtime subscription or pg_cron polling) and pushes them to Money Lover. It runs on a small always-on host — your Mac Mini M4 dev machine is perfect for this during development; for production use Railway or Fly.io (free tier sufficient).

---

### 14.2 MCP Package: Available Tools

The `@ferdhika31/moneylover-mcp` package exposes these tools usable as a Node.js library:

| Tool | What it does |
|---|---|
| `MoneyloverClient.getToken(email, password)` | Authenticate, returns JWT |
| `client.getWallets()` | List all wallets |
| `client.getCategories(walletId)` | List categories in a wallet |
| `client.getTransactions(walletId, startDate, endDate)` | Fetch transactions |
| `client.addTransaction({ walletId, categoryId, amount, date, note })` | Create a transaction |

Token is cached locally and auto-refreshed. Auth uses email + password from env vars.

---

### 14.3 Sync Service Design

**Repository:** `cattery-moneylover-sync` (separate repo or monorepo package)

**Stack:** Node.js 22+, TypeScript, `@ferdhika31/moneylover-mcp` (as library), `@supabase/supabase-js`

**Environment variables:**
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
MONEYLOVER_EMAIL=
MONEYLOVER_PASSWORD=
MONEYLOVER_WALLET_ID=        # your target Money Lover wallet ID
MONEYLOVER_CATEGORY_MAP=     # JSON map (see below)
```

**Startup flow:**
1. Authenticate to Money Lover → get + cache JWT
2. Fetch all Money Lover categories for the configured wallet → build category map
3. Subscribe to Supabase Realtime on `financial_transactions` table for `INSERT` events
4. For each new transaction → push to Money Lover (see below)

---

### 14.4 Category Mapping

Money Lover uses its own internal category IDs. You need to map your cattery's transaction categories to Money Lover category IDs. This is a one-time setup stored in the sync service env var as JSON:

```json
{
  "vet_medical": "<moneyLoverCategoryId>",
  "transport": "<moneyLoverCategoryId>",
  "medicine_vitamins": "<moneyLoverCategoryId>",
  "food_supplies": "<moneyLoverCategoryId>",
  "stock_purchase": "<moneyLoverCategoryId>",
  "grooming": "<moneyLoverCategoryId>",
  "staff_payroll": "<moneyLoverCategoryId>",
  "equipment": "<moneyLoverCategoryId>",
  "utilities": "<moneyLoverCategoryId>",
  "other_expense": "<moneyLoverCategoryId>",
  "adoption_fee": "<moneyLoverCategoryId>",
  "kitten_sale": "<moneyLoverCategoryId>",
  "stud_fee": "<moneyLoverCategoryId>",
  "other_income": "<moneyLoverCategoryId>"
}
```

Admin sets this up once via a **Money Lover Setup page** in the cattery admin panel (see 14.6).

---

### 14.5 Transaction Push Logic

When a new `financial_transactions` row is detected:

```
1. Skip if row.moneylover_sync_status = 'synced' or 'skipped'
2. Skip if row.auto_generated = true AND source already has a parent
   (e.g. don't double-push if stock purchase was already pushed separately)
3. Look up Money Lover category ID from category map using row.category_slug
4. If category not found → mark as 'skipped', log warning
5. Call client.addTransaction({
     walletId: MONEYLOVER_WALLET_ID,
     categoryId: mappedCategoryId,
     amount: row.amount,
     date: row.transaction_date (YYYY-MM-DD),
     note: `[Cattery] ${row.description}` (truncated to 255 chars)
   })
6. On success → update row: moneylover_sync_status = 'synced', moneylover_tx_id = response.id
7. On failure → update row: moneylover_sync_status = 'failed', moneylover_error = error message
8. Retry failed rows every 15 minutes (up to 3 attempts), then mark 'failed_permanent'
```

**Schema additions to `financial_transactions`:**
```
moneylover_sync_status   TEXT  default 'pending'
  -- values: pending | synced | skipped | failed | failed_permanent
moneylover_tx_id         TEXT  nullable  -- Money Lover's returned transaction ID
moneylover_synced_at     TIMESTAMPTZ nullable
moneylover_error         TEXT  nullable  -- last error message if failed
moneylover_retry_count   INT   default 0
```

---

### 14.6 Admin UI: Money Lover Settings Page

A dedicated page in the Admin Centre → Settings → "Money Lover Sync".

**Sections:**

**Connection Status**
- Green badge "Connected" / Red badge "Disconnected"
- Last successful sync timestamp
- Button: "Test Connection" → triggers a live auth check

**Wallet Selection**
- Dropdown: lists all wallets fetched from Money Lover account
- Save selected wallet ID to system_settings

**Category Mapping**
- Table: each cattery transaction category → dropdown of Money Lover categories (fetched live)
- Save button → stores mapping to system_settings as JSON
- "Refresh Money Lover Categories" button (in case user adds new categories in Money Lover app)

**Sync Log**
- Last 50 sync events: transaction description | amount | date | status | error (if failed)
- Filter by status (pending / synced / failed)
- "Retry Failed" button → manually triggers retry of all `failed` rows

**Enable / Disable Toggle**
- Global on/off for the Money Lover sync (stored in system_settings)
- When disabled: transactions still recorded in Supabase, `moneylover_sync_status` stays `pending`
- When re-enabled: all pending rows are picked up and pushed

---

### 14.7 Deployment: Sync Service

**Development:** run locally on Mac Mini M4 (`npm run dev` — watches Supabase Realtime)

**Production options (cheapest first):**
| Option | Cost | Notes |
|---|---|---|
| Railway | Free tier / ~$5/mo | Easiest, auto-deploy from GitHub |
| Fly.io | Free tier | Good for always-on Node.js |
| Render | Free tier (with sleep) | OK but sleeps — use paid to avoid |
| Your Mac Mini M4 | Free | Fine if always on + stable internet |

Recommended: **Railway** — push to GitHub, Railway auto-deploys, set env vars in dashboard.

**Process manager:** run with `pm2` locally or let Railway/Fly handle restarts.

---

### 14.8 Failure Handling & Guarantees

| Scenario | Behaviour |
|---|---|
| Money Lover API down | Transaction stays `pending`, retried every 15 min |
| Token expired | Service auto-refreshes token before retry |
| Money Lover changes API | Push fails, marked `failed_permanent` after 3 attempts. Admin notified via in-app alert. Cattery data unaffected. |
| Sync service crashes | On restart, queries all `pending` rows and replays them — no duplicates because each row is only pushed once (idempotency checked via `moneylover_sync_status`) |
| Category not mapped | Transaction marked `skipped`, visible in sync log for Admin to review and re-map |

---

### 14.9 What Does NOT Sync

To keep things clean and avoid noise in Money Lover, the following are **not** pushed:
- Voided transactions (cancelled adoptions etc.)
- Internal adjustments / corrections flagged by Admin
- Any transaction where `moneylover_sync_status = 'skipped'` (admin can override per-row)

---

## 16. Development Phases & Agent Handoff Protocol

### 16.1 Handoff Document Rule

> **This rule is mandatory for every phase, without exception.**

At the completion of each phase, the implementing agent **must** create a new Markdown file in the repository at:

```
/docs/phases/phase-XX-handoff.md
```

Where `XX` is the zero-padded phase number (e.g. `phase-01-handoff.md`, `phase-10-handoff.md`).

---

### 16.2 Handoff Document Structure

Each handoff file must follow this exact template:

```markdown
# Phase XX — [Phase Name] — Handoff

**Completed by:** [agent or developer name / model]
**Completed at:** [ISO date, e.g. 2025-11-14]
**Branch / commit:** [git branch name and commit SHA]

---

## What Was Built

A concise but complete summary of everything implemented in this phase:
- List every feature, screen, component, API route, and DB migration delivered
- Note any deviations from the spec and the reason (e.g. "Used X instead of Y because Z")
- List all new environment variables added and what they do

## Database Changes

- List every new table created (with migration filename)
- List every column added to existing tables
- List any RLS policies added or modified
- List any Edge Functions or pg_cron jobs added

## Known Issues & Shortcuts

- Anything cut from the original spec for this phase and why
- Any tech debt introduced intentionally (e.g. "hardcoded X, should be config in Phase N")
- Any bugs known but not yet fixed, with reproduction steps

## Test Coverage

- List what is tested (unit, integration, E2E)
- List what is NOT tested and should be

## Notes for Next Agent

- Explicit instructions for whoever picks up Phase XX+1
- Files or modules the next agent must read before starting
- Any gotchas, non-obvious decisions, or context that won't be obvious from code alone
- Link to relevant spec sections for the next phase

## Next Phase Preview

Brief summary of what Phase XX+1 involves, copied from §16.3 below, so the next agent
has immediate context without needing to read the full spec first.
```

---

### 16.3 Phase Table

| Phase | Name | Scope |
|---|---|---|
| **1** | Foundation | Auth, user management, cat CRUD + photos + pedigree photo; i18n (EN + MS); dark/light mode; viewport rules; React Query + Zod setup; `<ResponsiveModal>` component |
| **2** | Rooms | Room directory CRUD, cat room assignment, movement log, room overview UI |
| **3** | Assignees | Cat assignee system; My Cats dashboard; Cat Sitter bottom tab nav; quick-action buttons |
| **4** | Daily Care Logs | Weight logs; eating logs (multi-food, feeding method, calorie tracking); food catalogue with `calories_per_gram`; daily kcal progress on cat profile |
| **5** | Preventive Health | Vaccination records + reminders; deworming/flea records + reminders |
| **6** | Medication | Scheduled medication (admin-set plans → daily task list); ad hoc medicine/vitamin log; compliance tracking |
| **7** | PWA | next-pwa config; push notifications; offline caching; background sync for task ticks; iOS splash screens |
| **8** | Health Tickets | Health ticket open/update/resolve flow; activity thread; ticket medications; vet visit linking; Admin + Sitter views |
| **9** | Breeding | Mating records; kitten/litter registration; lineage tree; heat cycle log; breeding calendar; `.ics` export |
| **10** | Vet & Medical | Clinic/doctor directory; vet visit records; prescribed medicines; lab result file upload (no OCR) |
| **11** | Reports | Full admin reporting hub; all charts; CSV export; payroll summary; calorie intake trends; vet cost report *(moved up from §13 — prioritised ahead of finance/adoption)* |
| **12** | Polish | Audit log; system settings UI; export CSV/PDF; performance review; accessibility pass *(moved up from §15)* |
| **13** | Finance | Income/expense ledger; transaction categories (incl. Electricity); payroll + salary definitions; transfer proof upload; Cat Sitter payroll view (own only); auto-transactions from vet/adoption/stock |
| **14** | Adoption | Adopter profile; adoption record; contract upload; cat status auto-update; financial auto-transaction |
| **15** | Blood Test OCR | Claude API extraction of blood markers; structured storage; trend charts per marker *(future)* |
| **16** | Stock | Item catalogue; stock-in/out ledger; FIFO batch expiry; low stock alerts; expiry warnings |
| **17** | Money Lover Sync | Node.js sync service; Supabase Realtime listener; category mapping UI; sync log in Admin panel |

---

### 16.4 File Naming & Location

```
/docs/
  phases/
    phase-01-handoff.md
    phase-02-handoff.md
    ...
  SPEC.md          ← this file (master spec, always up to date)
```

If the spec is updated mid-build (new features added by the product owner), the agent making the spec change must note it in the **current in-progress phase's handoff doc** under a `## Spec Updates` section, so the changelog is traceable.


