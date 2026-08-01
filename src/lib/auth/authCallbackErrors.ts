/** PKCE verifier missing — signup succeeded but session exchange failed (often different browser). */
export function isPkceVerifierError(message: string): boolean {
  return /pkce|code verifier/i.test(message);
}

export function formatAuthCallbackError(message: string): string {
  if (isPkceVerifierError(message)) {
    return 'Your email is confirmed. Sign in with your email and password on this device.';
  }
  return message;
}

export const EMAIL_CONFIRMED_LOGIN_MESSAGE =
  'Your email is confirmed. Sign in with your email and password on this device.';
