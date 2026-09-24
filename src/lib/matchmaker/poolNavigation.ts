const POOL_DISMISS_KEY = 'matchmaker_pool_dismiss';

export function markPoolMemberDismissed(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(POOL_DISMISS_KEY, userId);
  } catch {
    /* ignore */
  }
}

export function consumePoolMemberDismissed(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const id = sessionStorage.getItem(POOL_DISMISS_KEY);
    if (id) sessionStorage.removeItem(POOL_DISMISS_KEY);
    return id;
  } catch {
    return null;
  }
}
