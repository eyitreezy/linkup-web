import { isPkceVerifierError } from '@/lib/auth/authCallbackErrors';

export const PASSWORD_RESET_EXPIRED_MESSAGE =
  'Your password reset link has expired or is no longer valid.';

export const PASSWORD_RESET_INVALID_MESSAGE =
  'Your password reset link has expired or is no longer valid.';

/** Map Supabase recovery errors to safe, user-facing copy. */
export function formatRecoveryAuthError(message: string): string {
  if (isPkceVerifierError(message)) {
    return PASSWORD_RESET_EXPIRED_MESSAGE;
  }
  if (/expired|invalid|already been used|otp|token|session/i.test(message)) {
    return PASSWORD_RESET_EXPIRED_MESSAGE;
  }
  return message;
}
