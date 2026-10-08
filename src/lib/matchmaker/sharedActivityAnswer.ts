export const SHARED_ACTIVITY_OTHER_LABEL = 'Other';

export const SHARED_ACTIVITY_ANSWER_MAX_LENGTH = 100;

export const SHARED_ACTIVITY_OTHER_PREFIX = 'other:';

/** Client-side sentinel for selecting Other (not sent to server). */
export const SHARED_ACTIVITY_OTHER_SELECTION = '__shared_activity_other__';

export function sanitizeSharedActivityCustomInput(value: string): string {
  return value.slice(0, SHARED_ACTIVITY_ANSWER_MAX_LENGTH);
}

export function formatSharedActivityAnswerDisplay(raw: string | null | undefined): string {
  if (!raw) return '—';
  if (raw.startsWith(SHARED_ACTIVITY_OTHER_PREFIX)) {
    return raw.slice(SHARED_ACTIVITY_OTHER_PREFIX.length);
  }
  return raw;
}

export function buildSharedActivityAnswerPayload(
  selection: string | null,
  customText: string
): { ok: true; q1: string } | { ok: false; error: string } {
  if (!selection) {
    return { ok: false, error: 'Select an answer before submitting.' };
  }
  if (selection === SHARED_ACTIVITY_OTHER_SELECTION) {
    const detail = sanitizeSharedActivityCustomInput(customText.trim());
    if (!detail) {
      return { ok: false, error: 'Enter your answer before submitting.' };
    }
    return { ok: true, q1: `${SHARED_ACTIVITY_OTHER_PREFIX}${detail}` };
  }
  const preset = selection.trim();
  if (!preset) {
    return { ok: false, error: 'Select an answer before submitting.' };
  }
  if (preset.length > SHARED_ACTIVITY_ANSWER_MAX_LENGTH) {
    return { ok: false, error: 'Answer must be 100 characters or fewer.' };
  }
  return { ok: true, q1: preset };
}

export function canSubmitSharedActivityAnswer(
  selection: string | null,
  customText: string
): boolean {
  return buildSharedActivityAnswerPayload(selection, customText).ok;
}
