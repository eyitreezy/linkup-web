import type { OnboardingDraft } from '@/types/onboarding';

export function profileLocationFromDraft(draft: OnboardingDraft) {
  return {
    location_label: draft.locationLabel.trim() || null,
    latitude: draft.locationLatitude,
    longitude: draft.locationLongitude,
  };
}

export function hasValidProfileLocation(draft: OnboardingDraft): boolean {
  return (
    draft.locationLabel.trim().length > 0 &&
    draft.locationLatitude != null &&
    draft.locationLongitude != null &&
    Number.isFinite(draft.locationLatitude) &&
    Number.isFinite(draft.locationLongitude)
  );
}
