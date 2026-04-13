# Phase XX — [Phase Name] — Handoff

**Completed by:** [agent or developer name / model]  
**Completed at:** [ISO date, e.g. 2026-04-15]  
**Branch / commit:** [git branch name] @ [commit SHA]  
**Spec version ref:** [last line changed in SPEC.md, or commit SHA of spec at time of build]

---

## What Was Built

A concise but complete summary of everything implemented in this phase.

### Features & Screens
- [ ] Feature A — brief description
- [ ] Feature B — brief description
- [ ] Screen / page / component name — what it does

### API Routes Added
| Method | Path | Description |
|---|---|---|
| GET | `/api/...` | |
| POST | `/api/...` | |

### Deviations from Spec
List anything built differently from the spec, and why:
- "Used X instead of Y because Z"
- "Skipped field `foo` — deferred to Phase N because reason"

### New Environment Variables
| Variable | Description | Required |
|---|---|---|
| `VAR_NAME` | What it does | Yes/No |

---

## Database Changes

### New Tables
| Table | Migration file | Notes |
|---|---|---|
| `table_name` | `YYYYMMDD_description.sql` | |

### Modified Tables
| Table | Change | Migration file |
|---|---|---|
| `existing_table` | Added column `foo TEXT` | `YYYYMMDD_description.sql` |

### RLS Policies Added / Modified
- `table_name`: [policy description, e.g. "Cat Sitters SELECT own rows only"]

### Edge Functions / pg_cron
- `function-name` — what it does, when it runs

---

## Known Issues & Shortcuts

### Intentional Tech Debt
- Description of shortcut taken + which phase should fix it

### Known Bugs
| Bug | Steps to reproduce | Severity |
|---|---|---|
| Description | 1. Do X 2. See Y | Low / Medium / High |

### Cut from This Phase
- Feature or detail from spec that was skipped, with reason

---

## Test Coverage

### What Is Tested
- Unit: [list]
- Integration: [list]
- E2E: [list]

### What Is NOT Tested (Should Be)
- [list gaps]

---

## Notes for Next Agent

> Read this section carefully before starting the next phase.

### Must-Read Files Before Starting
- `src/path/to/file.ts` — reason it's important
- `supabase/migrations/YYYYMMDD_xxx.sql` — what it sets up

### Non-Obvious Decisions
- Explanation of any architecture or logic decision that won't be obvious from the code

### Gotchas
- Things that will bite you if you don't know about them

### Context on Shared Components / Utils
- `<ComponentName>` — what it does, where it's used, what props matter

---

## Spec Updates This Phase

List any changes made to `SPEC.md` during this phase (new requirements added mid-build):

| Section | Change | Reason |
|---|---|---|
| §X.Y | Added field `foo` | Product owner requested |

---

## Next Phase Preview

**Phase XX+1 — [Name]**

[Copy the relevant row from §16.3 of SPEC.md here, plus any extra context the next agent needs to hit the ground running.]

Key files the next agent will likely touch:
- `src/...`
- `supabase/migrations/...`

Relevant spec sections:
- §X — [Section name]
- §Y — [Section name]
