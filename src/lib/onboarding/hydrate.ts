import { mediaDraftFromProfile } from '@/lib/profile/media/draft';
import { dedupePromptAnswers } from '@/lib/onboarding/promptAnswers';
import type { DbProfileVideo } from '@/lib/profile/media/types';
import type { DbProfile } from '@/types/database';
import { defaultOnboardingDraft, type OnboardingDraft } from '@/types/onboarding';

export function ageFromBirthDate(b: Date): number {
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return Math.max(0, a);
}

export function draftFromProfile(p: DbProfile | null, video?: DbProfileVideo | null): OnboardingDraft {
  const d = defaultOnboardingDraft();
  if (!p) return d;

  if (p.display_name) d.displayName = p.display_name;
  if (p.bio) d.bio = p.bio;
  if (p.birth_date) {
    const [y, m, day] = p.birth_date.split('-').map(Number);
    if (y && m && day) d.birthDate = new Date(y, m - 1, day);
  }
  d.profileMedia = mediaDraftFromProfile(p, video ?? null);
  d.remotePhotoUrls = [...(p.photo_urls ?? [])];
  d.localPhotoFiles = [];
  if (p.age_min != null) d.ageMin = p.age_min;
  if (p.age_max != null) d.ageMax = p.age_max;
  if (p.radius_km != null) d.radiusKm = Number(p.radius_km);
  if (p.location_label?.trim()) d.locationLabel = p.location_label.trim();
  if (p.latitude != null && p.longitude != null) {
    d.locationLatitude = p.latitude;
    d.locationLongitude = p.longitude;
  }
  d.profilePublic = p.is_profile_public;
  if (p.gender) d.selfGender = p.gender;

  const pref = p.preferences ?? {};
  if (pref.adult_confirmed === true) d.adultConfirmed = true;
  if (Array.isArray(pref.languages)) d.languages = pref.languages as string[];
  if (Array.isArray(pref.interests)) d.interests = pref.interests as string[];
  if (
    pref.meeting_intent === 'friendship' ||
    pref.meeting_intent === 'dating' ||
    pref.meeting_intent === 'activity' ||
    pref.meeting_intent === 'networking'
  ) {
    d.meetingIntent = pref.meeting_intent;
  }
  if (pref.show_me === 'everyone' || pref.show_me === 'women' || pref.show_me === 'men') {
    d.showMe = pref.show_me;
  }

  const raw = pref.prompt_answers;
  if (Array.isArray(raw) && raw.length > 0) {
    d.promptAnswers = dedupePromptAnswers(
      raw.map((x: { prompt_id?: string; prompt?: string; answer?: string }) => ({
        promptId: String(x.prompt_id ?? 'custom'),
        prompt: String(x.prompt ?? ''),
        answer: String(x.answer ?? ''),
      }))
    );
  }

  return d;
}
