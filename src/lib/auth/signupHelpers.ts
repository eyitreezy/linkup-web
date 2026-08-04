import type { User } from '@supabase/supabase-js';

/** Trim + lowercase so Gmail variants don't look like separate accounts. */
export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * With email confirmation enabled, Supabase returns a user but no identities when the
 * email is already registered — and does not send another confirmation email.
 */
export function isDuplicateEmailSignup(user: User | null | undefined): boolean {
  return Boolean(user && (!user.identities || user.identities.length === 0));
}

export const DUPLICATE_EMAIL_SIGNUP_MESSAGE =
  'An account with this email already exists. Log in, or resend the verification email if you have not confirmed yet.';

export function formatSignUpError(message: string): string {
  if (/already registered|already been registered|user already exists/i.test(message)) {
    return DUPLICATE_EMAIL_SIGNUP_MESSAGE;
  }
  if (/rate limit|too many requests|email.*limit/i.test(message)) {
    return 'Too many emails sent. Wait a few minutes and try again.';
  }
  return message;
}
