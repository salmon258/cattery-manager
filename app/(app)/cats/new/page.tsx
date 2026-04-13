import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { CatForm } from '@/components/cats/cat-form';

export default async function NewCatPage() {
  const user = await getCurrentUser();
  if (!user || user.profile.role !== 'admin') redirect('/cats');
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">New cat</h1>
      <CatForm mode="create" />
    </div>
  );
}
