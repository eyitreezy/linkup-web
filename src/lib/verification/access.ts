import type { UserVerification } from '@/types/database';

export function isUserVerified(verificationStatus: UserVerification | null | undefined): boolean {
  return verificationStatus === 'verified';
}

export type VerificationGateOpts = {
  isAdmin?: boolean;
  verifiedBadge?: boolean | null;
};

export function requiresVerificationGate(
  verificationStatus: UserVerification | null | undefined,
  opts?: VerificationGateOpts
): boolean {
  if (opts?.isAdmin) return false;
  if (opts?.verifiedBadge) return false;
  return !isUserVerified(verificationStatus);
}
