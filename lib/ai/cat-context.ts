import type { SupabaseClient } from '@supabase/supabase-js';

const WEIGHT_LIMIT = 30;
const EATING_LIMIT = 30;
const VET_LIMIT = 15;
const TICKET_LIMIT = 20;
const AD_HOC_LIMIT = 20;
const VAX_LIMIT = 20;
const PREV_LIMIT = 20;

function ageFromDob(dob: string | null | undefined): string {
  if (!dob) return 'unknown';
  const b = new Date(dob);
  const n = new Date();
  let years = n.getFullYear() - b.getFullYear();
  let months = n.getMonth() - b.getMonth();
  if (n.getDate() < b.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years <= 0 && months <= 0) {
    const days = Math.floor((n.getTime() - b.getTime()) / 86_400_000);
    return `${days} day${days === 1 ? '' : 's'}`;
  }
  return years >= 1
    ? `${years}y ${months}m`
    : `${months} month${months === 1 ? '' : 's'}`;
}

function isoOrDash(v: string | null | undefined): string {
  return v ? new Date(v).toISOString().slice(0, 16).replace('T', ' ') : '—';
}

export async function buildCatContext(
  supabase: SupabaseClient,
  catId: string
): Promise<string> {
  const { data: cat } = await supabase.from('cats').select('*').eq('id', catId).single();
  if (!cat) throw new Error('Cat not found');

  const [
    { data: room },
    { data: assignee },
    { data: weights },
    { data: meds },
    { data: adHoc },
    { data: vax },
    { data: prev },
    { data: tickets },
    { data: visits },
    { data: eating }
  ] = await Promise.all([
    cat.current_room_id
      ? supabase.from('rooms').select('name').eq('id', cat.current_room_id).maybeSingle()
      : Promise.resolve({ data: null }),
    cat.assignee_id
      ? supabase.from('profiles').select('full_name').eq('id', cat.assignee_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('weight_logs')
      .select('recorded_at, weight_kg, notes')
      .eq('cat_id', catId)
      .order('recorded_at', { ascending: false })
      .limit(WEIGHT_LIMIT),
    supabase
      .from('medications')
      .select('medicine_name, dose, route, start_date, end_date, interval_days, time_slots, is_active, notes')
      .eq('cat_id', catId)
      .order('start_date', { ascending: false }),
    supabase
      .from('ad_hoc_medicines')
      .select('medicine_name, dose, unit, route, given_at, notes')
      .eq('cat_id', catId)
      .order('given_at', { ascending: false })
      .limit(AD_HOC_LIMIT),
    supabase
      .from('vaccinations')
      .select('vaccine_type, vaccine_name, administered_date, next_due_date, batch_number, notes')
      .eq('cat_id', catId)
      .order('administered_date', { ascending: false })
      .limit(VAX_LIMIT),
    supabase
      .from('preventive_treatments')
      .select('treatment_type, product_name, administered_date, next_due_date, notes')
      .eq('cat_id', catId)
      .order('administered_date', { ascending: false })
      .limit(PREV_LIMIT),
    supabase
      .from('health_tickets')
      .select('title, description, severity, status, created_at, resolved_at')
      .eq('cat_id', catId)
      .order('created_at', { ascending: false })
      .limit(TICKET_LIMIT),
    supabase
      .from('vet_visits')
      .select(
        'visit_date, visit_type, status, chief_complaint, diagnosis, treatment_performed, follow_up_date, notes, vet_visit_medicines(medicine_name, dose, frequency, duration)'
      )
      .eq('cat_id', catId)
      .order('visit_date', { ascending: false })
      .limit(VET_LIMIT),
    supabase
      .from('eating_logs')
      .select(
        'meal_time, feeding_method, notes, eating_log_items(quantity_given_g, quantity_eaten, estimated_kcal_consumed, food_items(name))'
      )
      .eq('cat_id', catId)
      .order('meal_time', { ascending: false })
      .limit(EATING_LIMIT)
  ]);

  const lines: string[] = [];
  lines.push(`# Cat profile: ${cat.name}`);
  lines.push('');
  lines.push('## Identity');
  lines.push(`- Name: ${cat.name}`);
  lines.push(`- Gender: ${cat.gender ?? 'unknown'}`);
  lines.push(`- Date of birth: ${cat.date_of_birth ?? 'unknown'}  (age: ${ageFromDob(cat.date_of_birth)})`);
  lines.push(`- Breed: ${cat.breed ?? 'unknown'}`);
  lines.push(`- Color / pattern: ${cat.color_pattern ?? '—'}`);
  lines.push(`- Spayed / neutered: ${cat.is_spayed ? 'yes' : 'no'}`);
  lines.push(`- Status: ${cat.status}`);
  lines.push(`- Microchip: ${cat.microchip_number ?? '—'}`);
  lines.push(`- Registration: ${cat.registration_number ?? '—'}`);
  lines.push(`- Current room: ${(room as { name: string } | null)?.name ?? '—'}`);
  lines.push(`- Assigned sitter: ${(assignee as { full_name: string } | null)?.full_name ?? 'unassigned'}`);
  if (cat.notes) lines.push(`- Notes: ${cat.notes}`);

  lines.push('');
  lines.push(`## Weight history (most recent ${weights?.length ?? 0})`);
  if (!weights?.length) {
    lines.push('- none recorded');
  } else {
    for (const w of weights) {
      const note = w.notes ? ` — ${w.notes}` : '';
      lines.push(`- ${isoOrDash(w.recorded_at)}: ${w.weight_kg} kg${note}`);
    }
  }

  lines.push('');
  lines.push(`## Eating logs (most recent ${eating?.length ?? 0})`);
  if (!eating?.length) {
    lines.push('- none recorded');
  } else {
    for (const e of eating) {
      type Item = {
        quantity_given_g: number | null;
        quantity_eaten: string | null;
        estimated_kcal_consumed: number | null;
        food_items: { name: string } | { name: string }[] | null;
      };
      const items = (e.eating_log_items as unknown as Item[] | null) ?? [];
      const itemsStr = items.length
        ? items
            .map((i) => {
              const food = Array.isArray(i.food_items) ? i.food_items[0] : i.food_items;
              return `${food?.name ?? 'food'} ${i.quantity_given_g ?? '—'}g (ate ${i.quantity_eaten ?? '—'}, ${i.estimated_kcal_consumed ?? '—'} kcal)`;
            })
            .join('; ')
        : '—';
      const note = e.notes ? ` — ${e.notes}` : '';
      lines.push(`- ${isoOrDash(e.meal_time)} [${e.feeding_method ?? 'self'}]: ${itemsStr}${note}`);
    }
  }

  lines.push('');
  lines.push(`## Medication schedules (${meds?.length ?? 0})`);
  if (!meds?.length) {
    lines.push('- none');
  } else {
    for (const m of meds) {
      const state = m.is_active ? 'active' : 'inactive';
      const end = m.end_date ?? 'ongoing';
      const note = m.notes ? ` — ${m.notes}` : '';
      lines.push(
        `- [${state}] ${m.medicine_name} ${m.dose} (${m.route}) from ${m.start_date} → ${end}, every ${m.interval_days}d at ${(m.time_slots as string[]).join('/')}${note}`
      );
    }
  }

  lines.push('');
  lines.push(`## Ad-hoc medicines given (most recent ${adHoc?.length ?? 0})`);
  if (!adHoc?.length) {
    lines.push('- none');
  } else {
    for (const a of adHoc) {
      const unit = a.unit ? ` ${a.unit}` : '';
      const dose = a.dose ? `${a.dose}${unit}` : '—';
      const note = a.notes ? ` — ${a.notes}` : '';
      lines.push(`- ${isoOrDash(a.given_at)}: ${a.medicine_name} ${dose} (${a.route})${note}`);
    }
  }

  lines.push('');
  lines.push(`## Vaccinations (${vax?.length ?? 0})`);
  if (!vax?.length) {
    lines.push('- none recorded');
  } else {
    for (const v of vax) {
      const next = v.next_due_date ? `, next due ${v.next_due_date}` : '';
      const batch = v.batch_number ? `, batch ${v.batch_number}` : '';
      const note = v.notes ? ` — ${v.notes}` : '';
      lines.push(`- ${v.administered_date}: ${v.vaccine_type} (${v.vaccine_name ?? '—'})${batch}${next}${note}`);
    }
  }

  lines.push('');
  lines.push(`## Preventive treatments (${prev?.length ?? 0})`);
  if (!prev?.length) {
    lines.push('- none recorded');
  } else {
    for (const p of prev) {
      const next = p.next_due_date ? `, next due ${p.next_due_date}` : '';
      const note = p.notes ? ` — ${p.notes}` : '';
      lines.push(`- ${p.administered_date}: ${p.treatment_type} (${p.product_name ?? '—'})${next}${note}`);
    }
  }

  lines.push('');
  lines.push(`## Health tickets (${tickets?.length ?? 0})`);
  if (!tickets?.length) {
    lines.push('- none');
  } else {
    for (const tk of tickets) {
      const desc = tk.description ? ` — ${tk.description}` : '';
      const resolved = tk.resolved_at ? ` (resolved ${isoOrDash(tk.resolved_at)})` : '';
      lines.push(
        `- [${tk.severity}/${tk.status}] ${isoOrDash(tk.created_at)}: ${tk.title}${desc}${resolved}`
      );
    }
  }

  lines.push('');
  lines.push(`## Vet visits (most recent ${visits?.length ?? 0})`);
  if (!visits?.length) {
    lines.push('- none recorded');
  } else {
    for (const v of visits) {
      lines.push(`- ${v.visit_date} [${v.visit_type}/${v.status}]`);
      if (v.chief_complaint) lines.push(`  · Complaint: ${v.chief_complaint}`);
      if (v.diagnosis) lines.push(`  · Diagnosis: ${v.diagnosis}`);
      if (v.treatment_performed) lines.push(`  · Treatment: ${v.treatment_performed}`);
      type VMed = { medicine_name: string; dose: string | null; frequency: string | null; duration: string | null };
      const meds = (v.vet_visit_medicines as unknown as VMed[] | null) ?? [];
      if (meds.length) {
        lines.push(
          `  · Prescribed: ${meds
            .map((m) => `${m.medicine_name}${m.dose ? ' ' + m.dose : ''}${m.frequency ? ', ' + m.frequency : ''}${m.duration ? ', ' + m.duration : ''}`)
            .join('; ')}`
        );
      }
      if (v.follow_up_date) lines.push(`  · Follow-up: ${v.follow_up_date}`);
      if (v.notes) lines.push(`  · Notes: ${v.notes}`);
    }
  }

  return lines.join('\n');
}
