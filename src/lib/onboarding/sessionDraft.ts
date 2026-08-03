import type { OnboardingDraft, PromptAnswer } from '@/types/onboarding';

const STORAGE_KEY = 'linkup_onboarding_session';

type StoredDraft = {
  userId: string;
  step: number;
  updatedAt: number;
  displayName: string;
  birthDate: string;
  adultConfirmed: boolean;
  bio: string;
  interests: string[];
  languages: string[];
  meetingIntent: OnboardingDraft['meetingIntent'];
  promptAnswers: PromptAnswer[];
  selfGender: string | null;
  showMe: OnboardingDraft['showMe'];
  ageMin: number;
  ageMax: number;
  radiusKm: number;
  locationLabel: string;
  locationLatitude: number | null;
  locationLongitude: number | null;
  profilePublic: boolean;
};

function toStored(userId: string, step: number, draft: OnboardingDraft): StoredDraft {
  return {
    userId,
    step,
    updatedAt: Date.now(),
    displayName: draft.displayName,
    birthDate: draft.birthDate.toISOString(),
    adultConfirmed: draft.adultConfirmed,
    bio: draft.bio,
    interests: draft.interests,
    languages: draft.languages,
    meetingIntent: draft.meetingIntent,
    promptAnswers: draft.promptAnswers,
    selfGender: draft.selfGender,
    showMe: draft.showMe,
    ageMin: draft.ageMin,
    ageMax: draft.ageMax,
    radiusKm: draft.radiusKm,
    locationLabel: draft.locationLabel,
    locationLatitude: draft.locationLatitude,
    locationLongitude: draft.locationLongitude,
    profilePublic: draft.profilePublic,
  };
}

function fromStored(stored: StoredDraft): Partial<OnboardingDraft> {
  const birthDate = new Date(stored.birthDate);
  return {
    displayName: stored.displayName,
    birthDate: Number.isNaN(birthDate.getTime()) ? undefined : birthDate,
    adultConfirmed: stored.adultConfirmed,
    bio: stored.bio,
    interests: stored.interests,
    languages: stored.languages,
    meetingIntent: stored.meetingIntent,
    promptAnswers: stored.promptAnswers,
    selfGender: stored.selfGender,
    showMe: stored.showMe,
    ageMin: stored.ageMin,
    ageMax: stored.ageMax,
    radiusKm: stored.radiusKm,
    locationLabel: stored.locationLabel,
    locationLatitude: stored.locationLatitude,
    locationLongitude: stored.locationLongitude,
    profilePublic: stored.profilePublic,
  };
}

export function saveOnboardingSessionDraft(userId: string, step: number, draft: OnboardingDraft): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toStored(userId, step, draft)));
  } catch {
    /* quota or private mode */
  }
}

export function loadOnboardingSessionDraft(
  userId: string
): { step: number; draft: Partial<OnboardingDraft> } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredDraft;
    if (stored.userId !== userId) return null;
    return { step: stored.step, draft: fromStored(stored) };
  } catch {
    return null;
  }
}

export function clearOnboardingSessionDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
