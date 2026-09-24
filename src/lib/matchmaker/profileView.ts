import type { PoolProfileRow } from '@/lib/matchmaker/compatibility';
import { buildCompatibilitySignals } from '@/lib/matchmaker/compatibility';
import { distanceKm } from '@/lib/location/distance';
import { formatPlanDistanceLabel } from '@/lib/plans/planDistanceLabel';
import type { DbProfile, ProfilePreferences } from '@/types/database';

const COMM_STYLE_LABELS: Record<string, string> = {
  daily: 'Prefers daily contact',
  few_times_week: 'Prefers regular contact',
  flexible: 'Flexible communication style',
};

const MEETING_INTENT_LABELS: Record<string, string> = {
  friendship: 'Friendship',
  dating: 'Dating',
  activity: 'Activities',
  networking: 'Networking',
};

export function communicationStyleLabel(style: string | null | undefined): string | null {
  if (!style) return null;
  return COMM_STYLE_LABELS[style] ?? null;
}

export function meetingIntentLabel(intent: string | null | undefined): string | null {
  if (!intent) return null;
  return MEETING_INTENT_LABELS[intent] ?? null;
}

export function sharedLanguages(
  viewerPrefs: ProfilePreferences | null | undefined,
  candidatePrefs: ProfilePreferences | null | undefined
): string[] {
  const viewerSet = new Set((viewerPrefs?.languages as string[] | undefined) ?? []);
  const candidateLangs = (candidatePrefs?.languages as string[] | undefined) ?? [];
  return candidateLangs.filter((lang) => viewerSet.has(lang));
}

export function profileDistanceLabel(
  viewer: Pick<DbProfile, 'latitude' | 'longitude'> | null | undefined,
  candidate: Pick<DbProfile, 'latitude' | 'longitude'> | null | undefined
): string | null {
  const vLat = viewer?.latitude;
  const vLng = viewer?.longitude;
  const cLat = candidate?.latitude;
  const cLng = candidate?.longitude;
  if (vLat == null || vLng == null || cLat == null || cLng == null) return null;
  const km = distanceKm(vLat, vLng, cLat, cLng);
  if (!Number.isFinite(km)) return null;
  return formatPlanDistanceLabel({
    distanceKm: km,
    viewerHasLocation: true,
    planHasLocation: true,
    style: 'line',
  });
}

export type MatchMakerProfileInsight = {
  id: string;
  icon: string;
  label: string;
  shared?: boolean;
};

export function buildMatchMakerProfileInsights(args: {
  viewer: {
    communication_style?: string | null;
    preferences?: ProfilePreferences | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  candidate: DbProfile;
}): MatchMakerProfileInsight[] {
  const candidateRow: PoolProfileRow = {
    user_id: args.candidate.user_id,
    display_name: args.candidate.display_name,
    birth_date: args.candidate.birth_date ?? null,
    location_label: args.candidate.location_label,
    photo_urls: args.candidate.photo_urls,
    primary_photo_url: args.candidate.primary_photo_url,
    avatar_url: args.candidate.avatar_url,
    preferences: args.candidate.preferences,
    communication_style: (args.candidate as { communication_style?: string | null }).communication_style ?? null,
    latitude: args.candidate.latitude,
    longitude: args.candidate.longitude,
    verified_badge: args.candidate.verified_badge,
  };

  const insights: MatchMakerProfileInsight[] = [];

  for (const signal of buildCompatibilitySignals(args.viewer, candidateRow)) {
    insights.push({
      id: signal,
      icon: signal.startsWith('Shared interest')
        ? '🏷️'
        : signal.includes('communication') || signal.includes('contact')
          ? '💬'
          : signal.startsWith('Located in')
            ? '📍'
            : '✨',
      label: signal,
      shared: true,
    });
  }

  for (const lang of sharedLanguages(args.viewer.preferences, args.candidate.preferences)) {
    const label = `Shared language: ${lang}`;
    if (!insights.some((i) => i.label === label)) {
      insights.push({ id: label, icon: '🗣️', label, shared: true });
    }
  }

  const dist = profileDistanceLabel(
    {
      latitude: args.viewer.latitude ?? null,
      longitude: args.viewer.longitude ?? null,
    },
    args.candidate
  );
  if (dist && !insights.some((i) => i.label.includes('km'))) {
    insights.push({ id: `distance-${dist}`, icon: '📍', label: dist, shared: true });
  }

  const candidateComm = communicationStyleLabel(
    (args.candidate as { communication_style?: string | null }).communication_style
  );
  if (
    candidateComm &&
    !insights.some((i) => i.label.toLowerCase().includes('communication') || i.label.toLowerCase().includes('contact'))
  ) {
    insights.push({
      id: `comm-${candidateComm}`,
      icon: '💬',
      label: candidateComm,
      shared: false,
    });
  }

  return insights.slice(0, 5);
}
