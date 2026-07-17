import type { AdminTabId } from '@/features/admin/AdminShell.types';

const ADMIN_TAB_IDS: AdminTabId[] = [
  'verify',
  'reports',
  'moderation',
  'plan_disputes',
  'support',
  'users',
  'plans',
  'privacy_policy',
  'meet_types',
];

const ADMIN_TAB_SET = new Set<string>(ADMIN_TAB_IDS);

export function parseAdminTabId(value: string | null | undefined): AdminTabId | null {
  if (!value || !ADMIN_TAB_SET.has(value)) return null;
  return value as AdminTabId;
}

export function adminHref(tab?: string | null): string {
  const parsed = parseAdminTabId(tab);
  return parsed ? `/admin?tab=${parsed}` : '/admin';
}
