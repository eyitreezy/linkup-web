const STORAGE_KEY = 'linkup_subscription_checkout_tx_ref';

export function saveSubscriptionCheckoutTxRef(txRef: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, txRef.trim());
  } catch {
    /* ignore */
  }
}

export function loadSubscriptionCheckoutTxRef(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(STORAGE_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

export function clearSubscriptionCheckoutTxRef(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
