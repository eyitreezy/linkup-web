import {
  computeDraftMoodExpiresAt,
  computeUrgencyLevel,
  moodNegotiationExpiresAt,
  type MoodListingHours,
} from '@/lib/plans/moodPlanComputations';
import { deriveMoodListingHours } from '@/lib/plans/moodPlanUi';
import type { CreatorPlanRow } from '@/lib/plans/planManagement';

const MOOD_FIELD_KEYS = [
  'mood_type',
  'mood_expires_at',
  'mood_start_time',
  'mood_end_time',
  'auto_expiry_at',
  'urgency_level',
  'negotiation_expires_at',
] as const;

function buildMoodDraftFields(
  source: CreatorPlanRow,
  listingHours: MoodListingHours
): Record<string, unknown> {
  const scheduledAt = new Date();
  const moodExpiresAt = computeDraftMoodExpiresAt(listingHours);
  const moodExpiresIso = moodExpiresAt.toISOString();

  return {
    is_mood_plan: true,
    mood_type: source.mood_type ?? 'Chill',
    scheduled_at: scheduledAt.toISOString(),
    mood_expires_at: moodExpiresIso,
    mood_start_time: scheduledAt.toISOString(),
    mood_end_time: moodExpiresIso,
    auto_expiry_at: moodExpiresIso,
    urgency_level: computeUrgencyLevel(moodExpiresAt, scheduledAt),
    negotiation_expires_at: moodNegotiationExpiresAt(true, 2)?.toISOString() ?? null,
    is_paid: false,
    starting_price_cents: null,
    budget_min_cents: null,
    budget_max_cents: null,
    budget_tier: null,
    escrow_pattern: null,
    host_contribution_bps: null,
  };
}

/** Normalize RPC duplicate so mood plans stay mood drafts and standard plans stay non-mood. */
export function buildDuplicatePlanNormalizationPatch(
  source: CreatorPlanRow
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    status: 'draft',
    archived_at: null,
    is_expired: false,
    accepted_offer_id: null,
    agreed_price_cents: null,
    agreed_scheduled_at: null,
    agreed_location: null,
    agreed_notes: null,
  };

  if (source.is_mood_plan) {
    const listingHours = deriveMoodListingHours(source);
    return {
      ...base,
      ...buildMoodDraftFields(source, listingHours),
    };
  }

  const cleared: Record<string, unknown> = {
    ...base,
    is_mood_plan: false,
  };
  for (const key of MOOD_FIELD_KEYS) {
    cleared[key] = null;
  }
  return cleared;
}
