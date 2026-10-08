import { describe, expect, it } from 'vitest';
import {
  buildMatchMakerEndReasonPayload,
  canSubmitMatchMakerEndReason,
  MATCHMAKER_END_REASON_OTHER,
  sanitizeOtherEndReasonInput,
} from '@/lib/matchmaker/endConnectionReason';

describe('endConnectionReason', () => {
  it('passes through preset reasons', () => {
    expect(buildMatchMakerEndReasonPayload('Not compatible', '')).toEqual({
      ok: true,
      reason: 'Not compatible',
    });
  });

  it('requires other detail', () => {
    expect(canSubmitMatchMakerEndReason(MATCHMAKER_END_REASON_OTHER, '')).toBe(false);
    expect(buildMatchMakerEndReasonPayload(MATCHMAKER_END_REASON_OTHER, 'x').ok).toBe(true);
  });

  it('encodes other with 40 char max', () => {
    const detail = 'a'.repeat(40);
    expect(buildMatchMakerEndReasonPayload(MATCHMAKER_END_REASON_OTHER, detail)).toEqual({
      ok: true,
      reason: `other:${detail}`,
    });
    expect(sanitizeOtherEndReasonInput('a'.repeat(50)).length).toBe(40);
  });
});
