import type { createClient } from '@/lib/supabase/server';

type ServerClient = ReturnType<typeof createClient>;

// Fallback when the system_settings row is unavailable; matches the column default.
export const DEFAULT_GESTATION_DAYS = 63;

function addDays(yyyyMmDd: string, days: number): string {
  const d = new Date(yyyyMmDd);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function getGestationDays(supabase: ServerClient): Promise<number> {
  const { data } = await supabase
    .from('system_settings')
    .select('gestation_days')
    .eq('id', 1)
    .single();
  return data?.gestation_days ?? DEFAULT_GESTATION_DAYS;
}

export function expectedLaborDate(
  matingDate: string | null | undefined,
  gestationDays: number
): string | null {
  return matingDate ? addDays(matingDate, gestationDays) : null;
}
