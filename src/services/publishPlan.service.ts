import {
  computePublishedMoodTiming,
  computeUrgencyLevel,
  moodNegotiationExpiresAt,
  type MoodListingHours,
} from '@/lib/plans/moodPlanComputations';
import { validateMultiCitySelection } from '@/lib/plans/nigerianCities';
import { MIN_ESCROW_CENTS } from '@/lib/plans/planFinancialConfig';
import type { EscrowPattern } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

export type PublishPlanDraft = {
  meetTypeId: string;
  title: string;
  description: string;
  locationLabel: string;
  latitude: number | null;
  longitude: number | null;
  scheduledAt: Date;
  durationMinutes: number | null;
  visibility: 'public' | 'radius' | 'friends' | 'premium';
  isPaid: boolean;
  startingPriceNgn: string;
  escrowPattern: EscrowPattern | null;
  hostContributionBps: number;
  isMoodPlan: boolean;
  moodType: string;
  moodListingHours: MoodListingHours;
  spotlightBoost: boolean;
  premiumSubscriber: boolean;
  hideFromDiscovery?: boolean;
  isGroupPlan?: boolean;
  maxGuests?: number | null;
  maxFreeGuests?: number | null;
  maxPremiumGuests?: number | null;
  multiCity?: boolean;
  cityIds?: string[];
  isNegotiable?: boolean;
};

export function validatePublishDraft(draft: PublishPlanDraft): string | null {
  if (!draft.title.trim()) return 'Add a plan title.';
  if (!draft.meetTypeId) return 'Pick a meet type.';
  if (!draft.scheduledAt) return 'Set a date and time.';
  if (draft.isMoodPlan && !draft.moodType.trim()) return 'Pick a mood label for mood plans.';

  if (draft.isPaid) {
    const n = Number(draft.startingPriceNgn);
    const cents = Math.round(n * 100);
    if (!draft.startingPriceNgn.trim() || Number.isNaN(n)) return 'Enter a valid price in NGN.';
    if (cents < MIN_ESCROW_CENTS) return `Minimum paid plan amount is ₦${MIN_ESCROW_CENTS / 100}.`;
    if (!draft.escrowPattern) return 'Pick who funds the commitment (host, split, or guest).';
  }

  if (draft.isGroupPlan && draft.multiCity) {
    const cityErr = validateMultiCitySelection(draft.cityIds ?? []);
    if (cityErr) return cityErr;
  }

  return null;
}

export async function publishPlan(
  client: SupabaseClient,
  userId: string,
  draft: PublishPlanDraft
): Promise<{ planId: string | null; error: string | null }> {
  const validation = validatePublishDraft(draft);
  if (validation) return { planId: null, error: validation };

  const startingCents =
    draft.isPaid && draft.startingPriceNgn.trim()
      ? Math.round(Number(draft.startingPriceNgn) * 100)
      : null;

  const listingHours = draft.moodListingHours;
  const publishedMood = draft.isMoodPlan ? computePublishedMoodTiming(listingHours) : null;
  const moodScheduledAt = publishedMood?.scheduledAt ?? draft.scheduledAt;
  const moodExpiresAt = publishedMood?.moodExpiresAt ?? null;

  const moodExpiresIso = moodExpiresAt ? moodExpiresAt.toISOString() : null;
  const urgencyLevel =
    moodExpiresIso && moodExpiresAt
      ? computeUrgencyLevel(moodExpiresAt, moodScheduledAt)
      : null;
  const isMoodRow = !!(draft.isMoodPlan && moodExpiresIso);
  const negotiationIso = isMoodRow
    ? moodNegotiationExpiresAt(true, 2)?.toISOString() ?? null
    : null;

  const boostHours = draft.isMoodPlan && draft.premiumSubscriber ? 6 : draft.premiumSubscriber && draft.spotlightBoost ? 4 : 0;
  const boostedUntilIso =
    draft.premiumSubscriber && draft.spotlightBoost && boostHours > 0
      ? new Date(Date.now() + boostHours * 3600 * 1000).toISOString()
      : null;

  const insertRow: Record<string, unknown> = {
    creator_id: userId,
    meet_type_id: draft.meetTypeId,
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    starting_price_cents: startingCents,
    currency: 'NGN',
    status: 'negotiating',
    visibility: draft.visibility,
    scheduled_at: moodScheduledAt.toISOString(),
    location_label: draft.locationLabel.trim() || null,
    latitude: draft.latitude,
    longitude: draft.longitude,
    is_paid: draft.isPaid,
    budget_min_cents: draft.isPaid ? startingCents : null,
    budget_max_cents: draft.isPaid ? startingCents : null,
    budget_tier: draft.isPaid ? 'mid' : null,
    escrow_pattern: draft.isPaid ? draft.escrowPattern : null,
    host_contribution_bps:
      draft.isPaid && draft.escrowPattern === 'B' ? draft.hostContributionBps : null,
    is_mood_plan: isMoodRow,
    mood_expires_at: isMoodRow ? moodExpiresIso : null,
    duration_minutes: draft.durationMinutes,
    mood_type: isMoodRow ? draft.moodType.trim() : null,
    mood_start_time: isMoodRow ? moodScheduledAt.toISOString() : null,
    mood_end_time: isMoodRow && moodExpiresIso ? moodExpiresIso : null,
    auto_expiry_at: isMoodRow ? moodExpiresIso : null,
    urgency_level: isMoodRow ? urgencyLevel : null,
    negotiation_expires_at: isMoodRow ? negotiationIso : null,
    spotlight_enabled: !!draft.spotlightBoost,
    boosted_until: boostedUntilIso,
    is_group_plan: !!draft.isGroupPlan,
    max_free_guests: draft.isGroupPlan ? draft.maxFreeGuests ?? null : null,
    max_premium_guests: draft.isGroupPlan ? draft.maxPremiumGuests ?? null : null,
    max_guests: draft.isGroupPlan ? draft.maxGuests ?? null : null,
    multi_city: draft.isGroupPlan && draft.multiCity,
    city_ids: draft.isGroupPlan && draft.cityIds?.length ? draft.cityIds : null,
    hide_from_discovery: !!draft.hideFromDiscovery,
    is_negotiable:
      draft.isPaid && (draft.escrowPattern === 'B' || draft.escrowPattern === 'C')
        ? draft.isNegotiable !== false
        : true,
  };

  const { data: planIdRaw, error } = await client.rpc('publish_plan', { payload: insertRow });
  if (error) return { planId: null, error: error.message };
  if (planIdRaw == null) return { planId: null, error: 'No plan id returned from server.' };
  return { planId: String(planIdRaw), error: null };
}
