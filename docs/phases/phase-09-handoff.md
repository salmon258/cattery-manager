# Phase 9 — Breeding — Handoff

**Completed by:** Claude (Sonnet 4.6)
**Completed at:** 2026-04-13
**Branch / commit:** `main` @ (uncommitted)
**Spec version ref:** `cattery-management-spec.md` §3.2 (Breeding Module)

---

## What Was Built

### Database

- **`mating_records`** — one row per breeding pair event
  - `female_cat_id`, `male_cat_id` (FK to `cats`), `mating_date`, `mating_method` (natural|AI)
  - `expected_labor_date` — **generated column**: `mating_date + 63` days (no manual entry)
  - `status` (planned → confirmed → pregnant → delivered → failed)
  - `notes`, `created_by`, `created_at`, `updated_at`
  - Check constraint: `female_cat_id <> male_cat_id`

- **`litters`** — birth record linked to a mating record
  - `mating_record_id`, `birth_date`, `litter_size_born`, `litter_size_survived`, `notes`, `created_by`

- **`cat_lineage`** — parent-child relationship for each kitten
  - `kitten_id`, `mother_id`, `father_id`, `litter_id`
  - Unique on `kitten_id` (one lineage row per cat)

- **`heat_logs`** — female heat observations
  - `cat_id`, `observed_date`, `intensity` (mild|moderate|strong), `notes`, `logged_by`

- **Enums**: `mating_method`, `mating_status`, `heat_intensity`
- **RLS**: all authenticated users can read everything; only admins can write mating_records + litters + cat_lineage; all users can insert heat_logs; only admins can delete heat_logs

### API Routes

| Method | Route | Who | What |
|---|---|---|---|
| `GET` | `/api/mating-records` | all | List records; `?cat_id=` filter (female or male); `?status=` filter |
| `POST` | `/api/mating-records` | admin | Create mating record |
| `GET` | `/api/mating-records/[id]` | all | Full record + embedded cats + litters |
| `PATCH` | `/api/mating-records/[id]` | admin | Update status and/or notes |
| `POST` | `/api/mating-records/[id]/litters` | admin | Register litter; **side-effects**: creates Cat profiles for each named kitten, creates `cat_lineage` rows, sets record status = 'delivered' |
| `GET` | `/api/cats/[id]/heat-logs` | all | Heat log history for a cat |
| `POST` | `/api/cats/[id]/heat-logs` | all | Log a heat event |
| `DELETE` | `/api/heat-logs/[id]` | admin | Delete a heat log entry |
| `GET` | `/api/cats/[id]/lineage` | all | Parents, litter siblings, offspring |

### UI Components

- **`components/breeding/breeding-card.tsx`** — main card shown on cat detail page
  - Shows lineage (parents, siblings) for all cats
  - Shows mating records (as dam or stud depending on gender)
  - Shows heat log history for female cats
  - Shows offspring section (kittens from this cat's litters)
  - Admin: "New mating" button, "Update status" button per record, "Register litter" button (when delivered + no litter yet)
  - All users: "Log heat" button (female cats only)

- **`components/breeding/mating-record-modal.tsx`** — create new mating record
  - Pre-fills the current cat; shows opposite-sex cat selector from active cats

- **`components/breeding/update-status-modal.tsx`** — update mating record status

- **`components/breeding/litter-modal.tsx`** — register litter with dynamic kitten list
  - Each kitten gets a name + gender; auto-creates Cat profiles + lineage rows via API

- **`components/breeding/heat-log-modal.tsx`** — log a heat observation

### Admin Page

- **`app/(app)/breeding/page.tsx`** → `components/breeding/breeding-client.tsx`
  - Lists all active mating records sorted by status urgency (pregnant → confirmed → planned → delivered)
  - Shows female × male pair with avatars, status badge, mating date, expected labor date
  - Inline "Update status" / "Register litter" actions
  - Collapsible section for failed records

### Integrations

- **`components/cats/cat-detail.tsx`** — `<BreedingCard>` added after `<HealthTicketsCard>`, `md:col-span-2`
- **`components/app/admin-sidebar.tsx`** — "Breeding" nav item (`Dna` icon) in the Manage section

### Also Fixed (same PR)

- **`components/ui/avatar.tsx`** — added `object-cover` to `AvatarImage` to prevent photo distortion
- **`components/cats/cats-client.tsx`** — added ♀/♂ gender icon (colored Unicode, pink/blue) before cat name in list cards

---

## Migration: apply before testing

```bash
supabase db push
# or locally:
supabase migration up
```

Then regenerate types and uncomment Phase 9 aliases:

```bash
supabase gen types typescript --local > lib/supabase/types.ts
```

After regen, in `lib/supabase/aliases.ts` uncomment:
```ts
export type MatingRecord  = Database['public']['Tables']['mating_records']['Row']
export type Litter        = Database['public']['Tables']['litters']['Row']
export type CatLineage    = Database['public']['Tables']['cat_lineage']['Row']
export type HeatLog       = Database['public']['Tables']['heat_logs']['Row']
export type MatingMethod  = Database['public']['Enums']['mating_method']
export type MatingStatus  = Database['public']['Enums']['mating_status']
export type HeatIntensity = Database['public']['Enums']['heat_intensity']
```

Then remove the `// eslint-disable-next-line @typescript-eslint/no-explicit-any` + `(supabase as any)` casts in:
- `app/api/mating-records/route.ts`
- `app/api/mating-records/[id]/route.ts`
- `app/api/mating-records/[id]/litters/route.ts`
- `app/api/cats/[id]/heat-logs/route.ts`
- `app/api/heat-logs/[id]/route.ts`
- `app/api/cats/[id]/lineage/route.ts`

---

## Files Added / Modified

| File | Change |
|---|---|
| `supabase/migrations/20260420000000_phase9_breeding.sql` | New — DB tables + enums + RLS |
| `lib/schemas/breeding.ts` | New — Zod validation schemas |
| `app/api/mating-records/route.ts` | New |
| `app/api/mating-records/[id]/route.ts` | New |
| `app/api/mating-records/[id]/litters/route.ts` | New (litter + kitten + lineage side-effects) |
| `app/api/cats/[id]/heat-logs/route.ts` | New |
| `app/api/heat-logs/[id]/route.ts` | New |
| `app/api/cats/[id]/lineage/route.ts` | New |
| `components/breeding/breeding-card.tsx` | New |
| `components/breeding/mating-record-modal.tsx` | New |
| `components/breeding/update-status-modal.tsx` | New |
| `components/breeding/litter-modal.tsx` | New |
| `components/breeding/heat-log-modal.tsx` | New |
| `components/breeding/breeding-client.tsx` | New |
| `app/(app)/breeding/page.tsx` | New — admin breeding overview |
| `components/cats/cat-detail.tsx` | Added `<BreedingCard>`; removed unused `useMutation` import |
| `components/app/admin-sidebar.tsx` | Added Breeding nav item (`Dna` icon) |
| `components/ui/avatar.tsx` | Added `object-cover` to fix photo distortion |
| `components/cats/cats-client.tsx` | Added ♀/♂ gender icons |
| `lib/supabase/aliases.ts` | Added commented Phase 9 type aliases |
| `messages/en.json` | Added `breeding` section + `nav.breeding` + `common.notes/showMore/showLess` |
| `messages/id.json` | Added `breeding` section + `nav.breeding` + `common.notes/showMore/showLess` |

---

## Notes for Next Agent

> Read this before starting **Phase 10**.

### Key patterns from Phase 9

- **Generated columns in Postgres**: `expected_labor_date` is a generated stored column (`mating_date + 63`). Never try to insert/update it — it errors. PostgREST will include it in selects automatically.
- **Litter registration is a multi-step transaction**: the `POST /api/mating-records/[id]/litters` route does 4 operations sequentially (create litter → create cat per kitten → create lineage → update mating status). If any step fails partway through, previously created rows are not rolled back. For a production system, wrap this in a Postgres function/RPC.
- **Cat selector in modals**: `MatingRecordModal` fetches all active cats at open time and filters by gender client-side. For catteries with many cats, consider adding a search input to the selector.
- **Lineage API groups offspring by litter_id** but doesn't currently include litter birth_date in that grouping (only `litter_id` + kittens). Could be enriched later.

### Next Phase Preview

**Phase 10** — per spec §3.3–3.4 (Weight Tracking + Eating Reports enhancements) or check `cattery-management-spec.md` for the next prioritized phase.
