import type { ProfileMediaDraft } from '@/lib/profile/media/types';
import { defaultProfileMediaDraft } from '@/lib/profile/media/draft';
import type { ProfilePreferences } from '@/types/database';

export type MeetingIntent = 'friendship' | 'dating' | 'activity' | 'networking';
export type ShowMe = 'everyone' | 'women' | 'men';

export type PromptAnswer = {
  promptId: string;
  prompt: string;
  answer: string;
};

export type OnboardingDraft = {
  displayName: string;
  birthDate: Date;
  /** @deprecated Use profileMedia — kept for backward compatibility during migration */
  localPhotoFiles: File[];
  /** @deprecated Use profileMedia */
  remotePhotoUrls: string[];
  profileMedia: ProfileMediaDraft;
  adultConfirmed: boolean;
  bio: string;
  interests: string[];
  languages: string[];
  meetingIntent: MeetingIntent | null;
  promptAnswers: PromptAnswer[];
  selfGender: string | null;
  showMe: ShowMe;
  ageMin: number;
  ageMax: number;
  radiusKm: number;
  locationLabel: string;
  locationLatitude: number | null;
  locationLongitude: number | null;
  profilePublic: boolean;
};

export function defaultOnboardingDraft(): OnboardingDraft {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 25);
  return {
    displayName: '',
    birthDate: d,
    localPhotoFiles: [],
    remotePhotoUrls: [],
    profileMedia: defaultProfileMediaDraft(),
    adultConfirmed: false,
    bio: '',
    interests: [],
    languages: [],
    meetingIntent: null,
    promptAnswers: [{ promptId: 'green_flag', prompt: 'My biggest green flag is…', answer: '' }],
    selfGender: null,
    showMe: 'everyone',
    ageMin: 22,
    ageMax: 35,
    radiusKm: 25,
    locationLabel: '',
    locationLatitude: null,
    locationLongitude: null,
    profilePublic: true,
  };
}

export function preferencesFromDraft(draft: OnboardingDraft): ProfilePreferences {
  return {
    adult_confirmed: draft.adultConfirmed,
    languages: draft.languages,
    interests: draft.interests,
    meeting_intent: draft.meetingIntent ?? undefined,
    prompt_answers: draft.promptAnswers
      .filter((p) => p.answer.trim())
      .map(({ promptId, prompt, answer }) => ({ prompt_id: promptId, prompt, answer })),
    show_me: draft.showMe,
    self_gender: draft.selfGender ?? undefined,
  };
}
