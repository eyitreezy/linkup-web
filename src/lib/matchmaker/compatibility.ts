import type { ProfilePreferences } from '@/types/database';

export type PoolProfileRow = {
  user_id: string;
  display_name: string | null;
  birth_date: string | null;
  location_label: string | null;
  photo_urls?: string[] | null;
  primary_photo_url?: string | null;
  avatar_url?: string | null;
  preferences?: ProfilePreferences | null;
  communication_style?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  verified_badge?: boolean;
};

const COMM_LABELS: Record<string, string> = {
  daily: 'Both prefer daily contact',
  few_times_week: 'Both prefer regular contact',
  flexible: 'Both have a flexible communication style',
};

export function ageFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  const born = new Date(y, m - 1, d);
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const md = now.getMonth() - born.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < born.getDate())) age--;
  return age;
}

export function buildCompatibilitySignals(
  viewer: { communication_style?: string | null; preferences?: ProfilePreferences | null },
  candidate: PoolProfileRow
): string[] {
  const signals: string[] = [];
  const viewerInterests = new Set(viewer.preferences?.interests ?? []);
  const candidateInterests = candidate.preferences?.interests ?? [];
  const overlap = candidateInterests.filter((i) => viewerInterests.has(i)).slice(0, 2);
  overlap.forEach((tag) => signals.push(`Shared interest: ${tag}`));

  if (
    viewer.communication_style &&
    candidate.communication_style &&
    viewer.communication_style === candidate.communication_style
  ) {
    signals.push(COMM_LABELS[viewer.communication_style] ?? 'Similar communication style');
  }

  if (candidate.location_label?.trim()) {
    signals.push(`Located in ${candidate.location_label.trim()}`);
  }

  return signals.slice(0, 3);
}
