export type MatchMakerValuesRow = {
  faith: string | null;
  family_goals: string;
  pace_preference: string;
  communication_frequency: string | null;
  dealbreakers: Record<string, unknown> | null;
};

export type DealbreakersFormState = {
  faith: boolean;
  family: boolean;
  location: boolean;
  age: boolean;
  other: boolean;
  maxDistanceKm: string;
  ageMin: string;
  ageMax: string;
};

export type FaithFormState = {
  faith: string | null;
  faithType: string | null;
  otherFaithText: string;
};

const FAMILY_UI: Record<string, string> = {
  yes_want_children: 'yes',
  open_to_it: 'open',
  no_children: 'no',
  have_open_more: 'have_open',
  have_not_open_more: 'have_not',
};

const PACE_UI: Record<string, string> = {
  asap_21_days: 'asap',
  one_two_months: '1_2',
  three_six_months: '3_6',
  six_plus_months: 'long',
};

export function parseFaithFromDb(faith: string | null): FaithFormState {
  if (!faith) {
    return { faith: 'skip', faithType: null, otherFaithText: '' };
  }
  if (faith === 'open') {
    return { faith: 'open', faithType: null, otherFaithText: '' };
  }
  if (faith.startsWith('other:')) {
    return { faith: 'yes', faithType: 'other', otherFaithText: faith.slice('other:'.length) };
  }
  const knownTypes = ['Christianity', 'Islam', 'Prefer not to specify'];
  if (knownTypes.includes(faith)) {
    return { faith: 'yes', faithType: faith, otherFaithText: '' };
  }
  return { faith: 'yes', faithType: faith, otherFaithText: '' };
}

export function parseFamilyFromDb(familyGoals: string | null | undefined): string | null {
  if (!familyGoals) return null;
  return FAMILY_UI[familyGoals] ?? null;
}

export function parsePaceFromDb(pacePreference: string | null | undefined): string | null {
  if (!pacePreference) return null;
  return PACE_UI[pacePreference] ?? null;
}

export function parseDealbreakersFromDb(raw: Record<string, unknown> | null | undefined): {
  dealbreakers: DealbreakersFormState;
  otherDealbreakers: string[];
} {
  const db = raw ?? {};
  const otherRaw = db.other;
  const otherTags = Array.isArray(otherRaw)
    ? otherRaw.filter((t): t is string => typeof t === 'string')
    : [];

  return {
    dealbreakers: {
      faith: !!db.faith_alignment,
      family: !!db.family_goals_alignment,
      location: db.max_distance_km != null,
      age: db.age_min != null || db.age_max != null,
      other: otherTags.length > 0 || !!db.other,
      maxDistanceKm:
        db.max_distance_km != null ? String(db.max_distance_km) : '25',
      ageMin: db.age_min != null ? String(db.age_min) : '22',
      ageMax: db.age_max != null ? String(db.age_max) : '35',
    },
    otherDealbreakers: otherTags,
  };
}

export function hasCompleteMatchMakerValues(values: MatchMakerValuesRow | null | undefined): boolean {
  if (!values) return false;
  return Boolean(values.family_goals && values.pace_preference);
}

export function matchmakerValuesEditHref(step: number, focus?: 'communication'): string {
  const params = new URLSearchParams({ step: String(step), from: 'settings' });
  if (focus) params.set('focus', focus);
  return `/matchmaker/values?${params.toString()}`;
}
