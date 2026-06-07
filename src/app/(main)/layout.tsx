import { AuthMainLayout } from '@/components/auth/AuthMainLayout';
import { getServerAuthUser } from '@/lib/auth/server-session';
import type { ReactNode } from 'react';

export default async function MainLayout({ children }: { children: ReactNode }) {
  const initialUser = await getServerAuthUser();

  return <AuthMainLayout initialUser={initialUser}>{children}</AuthMainLayout>;
}
