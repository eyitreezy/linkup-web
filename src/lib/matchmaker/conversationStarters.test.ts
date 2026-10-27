import { describe, expect, it } from 'vitest';
import {
  CONVERSATION_STARTER_CATEGORIES,
  CONVERSATION_STARTER_CATEGORY_ORDER,
  applySharedInterestWording,
  pickQuickPickBatch,
  sharedPublicInterests,
  __conversationStarterLibraryForTests,
} from '@/lib/matchmaker/conversationStarters';

describe('conversationStarters', () => {
  it('lists categories in the required order', () => {
    expect(CONVERSATION_STARTER_CATEGORIES.map((c) => c.id)).toEqual([
      ...CONVERSATION_STARTER_CATEGORY_ORDER,
    ]);
  });

  it('includes five starters per category', () => {
    const lib = __conversationStarterLibraryForTests();
    for (const id of CONVERSATION_STARTER_CATEGORY_ORDER) {
      expect(lib[id]).toHaveLength(5);
    }
  });

  it('computes shared interests from public profile preferences only', () => {
    const overlap = sharedPublicInterests(
      { interests: ['hiking', 'coffee'] },
      { interests: ['coffee', 'music'] }
    );
    expect(overlap).toEqual(['coffee']);
  });

  it('personalizes shared-interest lines when a label is known', () => {
    const line = applySharedInterestWording(
      "I noticed we both enjoy this. What's your favourite part of it?",
      'Photography'
    );
    expect(line).toContain('Photography');
    expect(line).not.toContain(' enjoy this');
  });

  it('does not invent interest names when none are shared', () => {
    const line = applySharedInterestWording(
      'We seem to have something in common. How did you first get into it?',
      null
    );
    expect(line).toBe('We seem to have something in common. How did you first get into it?');
  });

  it('rotates quick-pick batches on refresh', () => {
    const first = pickQuickPickBatch({
      categoryId: 'easy_icebreakers',
      sharedInterest: null,
      refreshIndex: 0,
      excludeTexts: new Set(),
    });
    const second = pickQuickPickBatch({
      categoryId: 'easy_icebreakers',
      sharedInterest: null,
      refreshIndex: 1,
      excludeTexts: new Set(),
    });
    expect(first[0]).not.toBe(second[0]);
  });
});
