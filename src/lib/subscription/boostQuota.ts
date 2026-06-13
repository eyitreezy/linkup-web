import type { SubscriptionTier } from '@/lib/subscription/types';

export const MONTHLY_24H_BOOSTS: Record<SubscriptionTier, number> = {
  FREE: 0,
  SILVER: 4,
  GOLD: 8,
  PLATINUM: -1,
};

export const MONTHLY_SPOTLIGHTS: Record<SubscriptionTier, number> = {
  FREE: 0,
  SILVER: 3,
  GOLD: 10,
  PLATINUM: -1,
};

export function getMonthResetLabel(): string {
  const next = new Date();
  next.setMonth(next.getMonth() + 1, 1);
  return next.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

export type BoostQuotaMeta = {
  boosts_24hr_monthly?: number;
  boosts_24hr_used?: number;
  boosts_72hr_monthly?: number;
  boosts_72hr_used?: number;
  spotlights_monthly?: number;
  spotlights_used?: number;
};

export function boost24Label(meta: BoostQuotaMeta | undefined, allowed: boolean): string {
  if (!allowed) return 'Boost plan';
  const monthly = meta?.boosts_24hr_monthly;
  const used = meta?.boosts_24hr_used ?? 0;
  if (monthly === -1) return 'Boost plan (24h)';
  if (monthly != null && used >= monthly) return `No boosts left · resets ${getMonthResetLabel()}`;
  if (monthly != null) return `Boost plan (24h) · ${monthly - used} left`;
  return 'Boost plan (24h)';
}

export function boost72Label(meta: BoostQuotaMeta | undefined, allowed: boolean): string {
  if (!allowed) return 'Boost 72h';
  const monthly = meta?.boosts_72hr_monthly;
  const used = meta?.boosts_72hr_used ?? 0;
  if (monthly === -1) return 'Boost plan (72h)';
  if (monthly != null && used >= monthly) return `No 72h boosts left · resets ${getMonthResetLabel()}`;
  if (monthly != null && monthly > 0) return `Boost 72h · ${monthly - used} left`;
  return 'Boost plan (72h)';
}

export function isBoost24Exhausted(meta: BoostQuotaMeta | undefined): boolean {
  const monthly = meta?.boosts_24hr_monthly;
  if (monthly == null || monthly === -1) return false;
  return (meta?.boosts_24hr_used ?? 0) >= monthly;
}

export function isBoost72Exhausted(meta: BoostQuotaMeta | undefined): boolean {
  const monthly = meta?.boosts_72hr_monthly;
  if (monthly == null || monthly === -1) return false;
  return (meta?.boosts_72hr_used ?? 0) >= monthly;
}
