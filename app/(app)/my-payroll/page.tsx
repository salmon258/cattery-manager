import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { createClient } from '@/lib/supabase/server';
import { MyPayrollClient } from '@/components/finance/my-payroll-client';

export default async function MyPayrollPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');

  const supabase = createClient();
  const { data: settings } = await supabase
    .from('system_settings')
    .select('default_currency')
    .eq('id', 1)
    .maybeSingle();

  return <MyPayrollClient defaultCurrency={settings?.default_currency ?? 'IDR'} />;
}
