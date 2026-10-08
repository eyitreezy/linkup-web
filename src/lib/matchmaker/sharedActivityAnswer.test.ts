import { describe, expect, it } from 'vitest';
import {
  buildSharedActivityAnswerPayload,
  canSubmitSharedActivityAnswer,
  formatSharedActivityAnswerDisplay,
  sanitizeSharedActivityCustomInput,
  SHARED_ACTIVITY_OTHER_SELECTION,
} from '@/lib/matchmaker/sharedActivityAnswer';

describe('sharedActivityAnswer', () => {
  it('formats other: prefix for display', () => {
    expect(formatSharedActivityAnswerDisplay('other:Brunch and a walk')).toBe('Brunch and a walk');
    expect(formatSharedActivityAnswerDisplay('Food, friends, and good conversation')).toBe(
      'Food, friends, and good conversation'
    );
  });

  it('accepts preset option up to 100 chars', () => {
    const opt = 'a'.repeat(100);
    expect(buildSharedActivityAnswerPayload(opt, '')).toEqual({ ok: true, q1: opt });
  });

  it('rejects preset over 100 chars', () => {
    expect(buildSharedActivityAnswerPayload('a'.repeat(101), '').ok).toBe(false);
  });

  it('requires custom text for Other', () => {
    expect(canSubmitSharedActivityAnswer(SHARED_ACTIVITY_OTHER_SELECTION, '')).toBe(false);
    expect(canSubmitSharedActivityAnswer(SHARED_ACTIVITY_OTHER_SELECTION, '   ')).toBe(false);
  });

  it('stores other as other:detail', () => {
    const built = buildSharedActivityAnswerPayload(SHARED_ACTIVITY_OTHER_SELECTION, '  Quiet day  ');
    expect(built).toEqual({ ok: true, q1: 'other:Quiet day' });
  });

  it('sanitizes custom input to 100 chars', () => {
    expect(sanitizeSharedActivityCustomInput('x'.repeat(150)).length).toBe(100);
  });
});
