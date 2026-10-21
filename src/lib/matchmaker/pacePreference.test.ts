import { describe, expect, it } from 'vitest';
import {
  PACE_PREFERENCE_OPTIONS,
  PACE_PREFERENCE_PRIVATE_LABEL,
  PACE_PREFERENCE_QUESTION,
  PACE_PREFERENCE_STEP_TITLE,
  pacePreferenceDbFromUi,
  pacePreferenceDisplayLabel,
  parsePacePreferenceUiFromDb,
} from '@/lib/matchmaker/pacePreference';

describe('PACE_PREFERENCE copy', () => {
  it('uses exact step title, question, privacy label, and four options', () => {
    expect(PACE_PREFERENCE_STEP_TITLE).toBe('Pace Preference');
    expect(PACE_PREFERENCE_QUESTION).toBe('How long after connecting do you expect to meet?');
    expect(PACE_PREFERENCE_PRIVATE_LABEL).toBe('Private. Used for compatibility weighting only.');
    expect(PACE_PREFERENCE_OPTIONS.map((o) => o.label)).toEqual([
      'As soon as the platform allows (7 day minimum)',
      '1 to 2 weeks',
      '2 to 3 weeks',
      'I take my time, 1 months or more',
    ]);
  });
});

describe('pace preference persistence', () => {
  it('round-trips UI keys through pace_preference db values', () => {
    for (const opt of PACE_PREFERENCE_OPTIONS) {
      expect(pacePreferenceDbFromUi(opt.key)).toBe(opt.db);
      expect(parsePacePreferenceUiFromDb(opt.db)).toBe(opt.key);
      expect(pacePreferenceDisplayLabel(opt.db)).toBe(opt.label);
    }
  });

  it('does not map legacy month-based values to new chips', () => {
    expect(parsePacePreferenceUiFromDb('one_two_months')).toBeNull();
    expect(pacePreferenceDisplayLabel('one_two_months')).toBe('1 to 2 months');
  });

  it('preserves unrelated db values as Not set in display when unknown', () => {
    expect(parsePacePreferenceUiFromDb('unknown_value')).toBeNull();
    expect(pacePreferenceDisplayLabel('unknown_value')).toBe('Not set');
  });

  it('allows settings saves to keep legacy pace_preference until user re-selects Step 3', () => {
    expect(parsePacePreferenceUiFromDb('asap_21_days')).toBeNull();
    expect(pacePreferenceDbFromUi(null)).toBeNull();
    expect(pacePreferenceDbFromUi('asap')).toBe('asap_7_days');
  });
});
