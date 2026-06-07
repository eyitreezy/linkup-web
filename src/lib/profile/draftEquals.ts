import type { ProfileMediaDraft } from '@/lib/profile/media/types';
import type { OnboardingDraft } from '@/types/onboarding';

function birthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function localFileSig(file: File | undefined): string | null {
  if (!file) return null;
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function profileMediaSnapshot(media: ProfileMediaDraft) {
  return {
    photos: media.photos.map((p) => ({
      url: p.url,
      isPrimary: p.isPrimary,
      localSig: localFileSig(p.localFile),
    })),
    video: media.video
      ? {
          id: media.video.id ?? null,
          url: media.video.url,
          localSig: localFileSig(media.video.localFile),
        }
      : null,
  };
}

function draftSnapshot(draft: OnboardingDraft): string {
  return JSON.stringify({
    displayName: draft.displayName.trim(),
    birthDate: birthKey(draft.birthDate),
    bio: draft.bio,
    profilePublic: draft.profilePublic,
    interests: [...draft.interests].sort(),
    languages: [...draft.languages].sort(),
    meetingIntent: draft.meetingIntent,
    selfGender: draft.selfGender,
    showMe: draft.showMe,
    ageMin: draft.ageMin,
    ageMax: draft.ageMax,
    radiusKm: draft.radiusKm,
    locationLabel: draft.locationLabel.trim(),
    locationLatitude: draft.locationLatitude,
    locationLongitude: draft.locationLongitude,
    promptAnswers: draft.promptAnswers.map((p) => ({
      promptId: p.promptId,
      answer: p.answer.trim(),
    })),
    profileMedia: profileMediaSnapshot(draft.profileMedia),
  });
}

export function onboardingDraftsEqual(a: OnboardingDraft, b: OnboardingDraft): boolean {
  return draftSnapshot(a) === draftSnapshot(b);
}
