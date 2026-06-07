import type { DbUser } from '@/types/database';

export function isPremiumSubscriber(user: DbUser | null | undefined): boolean {
  if (!user?.premium_until) return false;
  if (new Date(user.premium_until).getTime() <= Date.now()) return false;
  if (user.subscription_status === 'expired') return false;
  return true;
}
