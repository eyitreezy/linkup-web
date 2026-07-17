const COOKIE = 'linkup_pending_signup_privacy_consent';

/** Set before OAuth redirect on signup so the callback can record consent once. */
export function markPendingSignupPrivacyConsent(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE}=1; path=/; max-age=600; SameSite=Lax`;
}

export function clearPendingSignupPrivacyConsent(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function hasPendingSignupPrivacyConsentCookie(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  return new RegExp(`(?:^|; )${COOKIE}=1(?:;|$)`).test(cookieHeader);
}

export const PENDING_SIGNUP_PRIVACY_CONSENT_COOKIE = COOKIE;
