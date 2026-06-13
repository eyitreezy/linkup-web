import type { DbUser } from '@/types/database';

export function hasBoostCredit(user: Pick<DbUser, 'boost_credits'> | null | undefined): boolean {
  return (user?.boost_credits ?? 0) > 0;
}
