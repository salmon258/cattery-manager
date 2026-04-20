import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { MyPayrollClient } from '@/components/finance/my-payroll-client';

export default async function MyPayrollPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');
  return <MyPayrollClient />;
}
