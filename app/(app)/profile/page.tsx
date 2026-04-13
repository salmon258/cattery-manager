import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');

  const t = await getTranslations();
  const tp = await getTranslations('profile');
  const tr = await getTranslations('users.roles');

  const p = user.profile;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{tp('title')}</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14">
              {p.avatar_url ? <AvatarImage src={p.avatar_url} alt={p.full_name} /> : null}
              <AvatarFallback>{p.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-base">{p.full_name}</CardTitle>
              <div className="mt-1 flex gap-2">
                <Badge variant="secondary">{tr(p.role)}</Badge>
                {!p.is_active && <Badge variant="destructive">inactive</Badge>}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <InfoRow label={tp('lastLogin')} value={formatDate(p.last_login_at)} />
          <InfoRow label={tp('language')} value={t(`language.${p.preferred_language}`)} />
          <InfoRow label={tp('theme')} value={t(`theme.${p.theme_preference}`)} />
          <p className="pt-2 text-xs text-muted-foreground">{tp('editHint')}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
