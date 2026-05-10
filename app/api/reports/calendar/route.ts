import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

export type CalendarCategory =
  | 'birth'
  | 'vaccination'
  | 'deworming'
  | 'flea'
  | 'combined'
  | 'mating'
  | 'heat'
  | 'vet_visit';

export type CalendarEvent = {
  id: string;
  date: string;
  category: CalendarCategory;
  /** 'past' for history rows; 'scheduled' for future / next-due rows. */
  kind: 'past' | 'scheduled';
  cat: { id: string; name: string } | null;
  title: string;
  detail?: string | null;
};

/**
 * GET /api/reports/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Admin only. Returns calendar events across categories within the date range.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url  = new URL(req.url);
  const from = url.searchParams.get('from');
  const to   = url.searchParams.get('to');
  if (!from || !to) return NextResponse.json({ error: 'from and to are required' }, { status: 400 });

  const todayStr = new Date().toISOString().slice(0, 10);
  const supabase = createClient();
  const events: CalendarEvent[] = [];

  // ─── Cat births ──────────────────────────────────────────────────────────
  const { data: cats } = await supabase
    .from('cats')
    .select('id, name, date_of_birth')
    .gte('date_of_birth', from)
    .lte('date_of_birth', to);
  for (const c of cats ?? []) {
    events.push({
      id: `birth:${c.id}`,
      date: c.date_of_birth,
      category: 'birth',
      kind: c.date_of_birth <= todayStr ? 'past' : 'scheduled',
      cat: { id: c.id, name: c.name },
      title: c.name,
      detail: 'Birth'
    });
  }

  // ─── Vaccinations (past + next due) ──────────────────────────────────────
  const { data: vacs } = await supabase
    .from('vaccinations')
    .select('id, vaccine_type, vaccine_name, administered_date, next_due_date, cat:cats(id, name)');
  for (const v of vacs ?? []) {
    const catRel = (v as any).cat as { id: string; name: string } | null;
    const label = v.vaccine_type === 'other' && v.vaccine_name
      ? v.vaccine_name
      : String(v.vaccine_type).toUpperCase();
    if (v.administered_date >= from && v.administered_date <= to) {
      events.push({
        id: `vac:given:${v.id}`,
        date: v.administered_date,
        category: 'vaccination',
        kind: 'past',
        cat: catRel,
        title: label,
        detail: 'Given'
      });
    }
    if (v.next_due_date && v.next_due_date >= from && v.next_due_date <= to) {
      events.push({
        id: `vac:due:${v.id}`,
        date: v.next_due_date,
        category: 'vaccination',
        kind: v.next_due_date < todayStr ? 'past' : 'scheduled',
        cat: catRel,
        title: label,
        detail: 'Next due'
      });
    }
  }

  // ─── Preventive treatments (deworming / flea / combined) ────────────────
  const { data: prevs } = await supabase
    .from('preventive_treatments')
    .select('id, treatment_type, product_name, administered_date, next_due_date, cat:cats(id, name)');
  for (const p of prevs ?? []) {
    const catRel = (p as any).cat as { id: string; name: string } | null;
    const cat: CalendarCategory =
      p.treatment_type === 'deworming' ? 'deworming'
      : p.treatment_type === 'flea'     ? 'flea'
      : 'combined';
    if (p.administered_date >= from && p.administered_date <= to) {
      events.push({
        id: `prev:given:${p.id}`,
        date: p.administered_date,
        category: cat,
        kind: 'past',
        cat: catRel,
        title: p.product_name,
        detail: 'Given'
      });
    }
    if (p.next_due_date && p.next_due_date >= from && p.next_due_date <= to) {
      events.push({
        id: `prev:due:${p.id}`,
        date: p.next_due_date,
        category: cat,
        kind: p.next_due_date < todayStr ? 'past' : 'scheduled',
        cat: catRel,
        title: p.product_name,
        detail: 'Next due'
      });
    }
  }

  // ─── Mating records ─────────────────────────────────────────────────────
  const { data: matings } = await supabase
    .from('mating_records')
    .select(`
      id, mating_date, expected_labor_date, status,
      female:cats!mating_records_female_cat_fkey(id, name),
      male:cats!mating_records_male_cat_fkey(id, name)
    `);
  for (const m of matings ?? []) {
    const female = (m as any).female as { id: string; name: string } | null;
    const male   = (m as any).male as { id: string; name: string } | null;
    const pair   = `${female?.name ?? '—'} × ${male?.name ?? '—'}`;
    if (m.mating_date >= from && m.mating_date <= to) {
      events.push({
        id: `mat:date:${m.id}`,
        date: m.mating_date,
        category: 'mating',
        kind: 'past',
        cat: female,
        title: pair,
        detail: 'Mating'
      });
    }
    if (m.expected_labor_date && m.expected_labor_date >= from && m.expected_labor_date <= to) {
      events.push({
        id: `mat:labor:${m.id}`,
        date: m.expected_labor_date,
        category: 'mating',
        kind: m.expected_labor_date < todayStr ? 'past' : 'scheduled',
        cat: female,
        title: pair,
        detail: 'Expected labor'
      });
    }
  }

  // ─── Heat logs ──────────────────────────────────────────────────────────
  const { data: heats } = await supabase
    .from('heat_logs')
    .select('id, observed_date, intensity, cat:cats(id, name)')
    .gte('observed_date', from)
    .lte('observed_date', to);
  for (const h of heats ?? []) {
    const catRel = (h as any).cat as { id: string; name: string } | null;
    events.push({
      id: `heat:${h.id}`,
      date: h.observed_date,
      category: 'heat',
      kind: 'past',
      cat: catRel,
      title: catRel?.name ?? '—',
      detail: `Heat · ${h.intensity}`
    });
  }

  // ─── Vet visits (visit + follow-up) ─────────────────────────────────────
  const { data: vets } = await supabase
    .from('vet_visits')
    .select('id, visit_date, follow_up_date, visit_type, cat:cats(id, name), clinic:clinics(id, name)');
  for (const v of vets ?? []) {
    const catRel    = (v as any).cat as { id: string; name: string } | null;
    const clinicRel = (v as any).clinic as { id: string; name: string } | null;
    const typeLabel = String(v.visit_type).replace(/_/g, ' ');
    if (v.visit_date >= from && v.visit_date <= to) {
      events.push({
        id: `vet:visit:${v.id}`,
        date: v.visit_date,
        category: 'vet_visit',
        kind: v.visit_date <= todayStr ? 'past' : 'scheduled',
        cat: catRel,
        title: typeLabel,
        detail: clinicRel?.name ?? null
      });
    }
    if (v.follow_up_date && v.follow_up_date >= from && v.follow_up_date <= to) {
      events.push({
        id: `vet:follow:${v.id}`,
        date: v.follow_up_date,
        category: 'vet_visit',
        kind: v.follow_up_date < todayStr ? 'past' : 'scheduled',
        cat: catRel,
        title: `${typeLabel} (follow-up)`,
        detail: clinicRel?.name ?? null
      });
    }
  }

  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return NextResponse.json({ events });
}
