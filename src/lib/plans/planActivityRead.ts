const KEY_PREFIX = 'linkup_plan_last_viewed_';

export function markPlanActivityRead(planId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${KEY_PREFIX}${planId}`, new Date().toISOString());
  } catch {
    // Non-critical
  }
}

export function hasNewActivity(
  planId: string,
  latestEngagementAt: string | null
): boolean {
  if (!latestEngagementAt || typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}${planId}`);
    if (!raw) return true;
    return new Date(latestEngagementAt).getTime() > new Date(raw).getTime();
  } catch {
    return false;
  }
}
