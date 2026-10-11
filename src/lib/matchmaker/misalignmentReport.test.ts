import { describe, expect, it } from 'vitest';
import {
  MISALIGNMENT_REPORT_MAX_EXPLANATION,
  sanitizeMisalignmentExplanation,
  validateMisalignmentSubmission,
} from '@/lib/matchmaker/misalignmentReport';

describe('misalignmentReport', () => {
  it('requires a reason', () => {
    expect(validateMisalignmentSubmission(null, '')).toEqual({
      ok: false,
      error: 'Select a reason before submitting.',
    });
  });

  it('allows empty explanation when reason is set', () => {
    expect(validateMisalignmentSubmission('other', '   ')).toEqual({ ok: true });
  });

  it('enforces 200 character explanation limit', () => {
    const long = 'a'.repeat(MISALIGNMENT_REPORT_MAX_EXPLANATION + 1);
    expect(validateMisalignmentSubmission('other', long).ok).toBe(false);
    expect(sanitizeMisalignmentExplanation(long).length).toBe(MISALIGNMENT_REPORT_MAX_EXPLANATION);
  });
});
