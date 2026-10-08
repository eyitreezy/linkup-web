export const MATCHMAKER_END_REASON_OTHER = 'Other';

export const MATCHMAKER_END_REASON_MAX_OTHER_LENGTH = 40;

export function sanitizeOtherEndReasonInput(value: string): string {
  return value.slice(0, MATCHMAKER_END_REASON_MAX_OTHER_LENGTH);
}

/** Persisted in `matchmaker_connections.end_reason` (private; not shown to partner). */
export function buildMatchMakerEndReasonPayload(
  selectedReason: string,
  otherDetail?: string
): { ok: true; reason: string } | { ok: false; error: string } {
  const reason = selectedReason.trim();
  if (!reason) {
    return { ok: false, error: 'Select a reason before ending this connection.' };
  }
  if (reason !== MATCHMAKER_END_REASON_OTHER) {
    return { ok: true, reason };
  }
  const detail = sanitizeOtherEndReasonInput((otherDetail ?? '').trim());
  if (!detail) {
    return { ok: false, error: 'Enter your reason before ending this connection.' };
  }
  return { ok: true, reason: `other:${detail}` };
}

export function canSubmitMatchMakerEndReason(
  selectedReason: string | null,
  otherDetail: string
): boolean {
  if (!selectedReason) return false;
  if (selectedReason !== MATCHMAKER_END_REASON_OTHER) return true;
  return sanitizeOtherEndReasonInput(otherDetail.trim()).length > 0;
}
