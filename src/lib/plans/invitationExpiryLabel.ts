/** User-facing invitation expiry label (e.g. "72hours", "12hours", "Expired"). */
export function formatInvitationExpiryLabel(expiresAtIso: string, nowMs = Date.now()): string {
  const msLeft = new Date(expiresAtIso).getTime() - nowMs;
  if (msLeft <= 0) return 'Expired';
  const hoursLeft = Math.max(1, Math.ceil(msLeft / (1000 * 60 * 60)));
  return `${hoursLeft}hours`;
}
