import {
  computeDraftMoodExpiresAt,
  computePublishedMoodTiming,
  computeUrgencyLevel,
  moodNegotiationExpiresAt,
  type MoodListingHours,
} from '@/lib/plans/moodPlanComputations';
import { MIN_ESCROW_CENTS } from '@/lib/plans/planFinancialConfig';
import type { DbPlan, EscrowPattern } from '@/types/database';

export type PlanVisibility = DbPlan['visibility'];

export type CreatorEditSaveMode = 'update' | 'draft' | 'publish';

export type CreatorEditCapabilities = {
  canEdit: boolean;
  lockReason: string | null;
  titleDescriptionCategory: boolean;
  visibility: boolean;
  scheduleLocationDuration: boolean;
  /** Drafts can switch mood on/off like create plan. */
  canToggleMood: boolean;
  /** Published / locked mood plans — mood fields without toggle. */
  moodPresentation: boolean;
  financial: boolean;
  canPublish: boolean;
};

export function isPlanRowLockedForCreatorEdit(
  plan: Pick<
    DbPlan,
    'archived_at' | 'is_expired' | 'is_mood_plan' | 'mood_expires_at' | 'status'
  >
): boolean {
  if (plan.archived_at != null) return true;
  if (plan.is_expired && plan.status !== 'draft') return true;
  if (
    plan.status !== 'draft' &&
    plan.is_mood_plan &&
    plan.mood_expires_at != null &&
    new Date(plan.mood_expires_at).getTime() <= Date.now()
  ) {
    return true;
  }
  if (plan.status === 'completed') return true;
  return false;
}

export function getCreatorEditCapabilities(plan: DbPlan, offersCount: number): CreatorEditCapabilities {
  if (isPlanRowLockedForCreatorEdit(plan)) {
    let lockReason: string | null = 'This plan can’t be edited in its current state.';
    if (plan.archived_at) lockReason = 'Unarchive this plan before editing.';
    else if (
      (plan.is_expired && plan.status !== 'draft') ||
      (plan.status !== 'draft' &&
        plan.is_mood_plan &&
        plan.mood_expires_at &&
        new Date(plan.mood_expires_at) <= new Date())
    )
      lockReason = 'Mood window ended — duplicate to create a fresh listing.';
    else if (plan.status === 'completed') lockReason = 'Completed plans are read-only.';
    return {
      canEdit: false,
      lockReason,
      titleDescriptionCategory: false,
      visibility: false,
      scheduleLocationDuration: false,
      canToggleMood: false,
      moodPresentation: false,
      financial: false,
      canPublish: false,
    };
  }

  const hasAccept = plan.accepted_offer_id != null;
  const hasOffers = offersCount > 0;
  const mood = !!plan.is_mood_plan;
  const isDraft = plan.status === 'draft';
  const canToggleMood = isDraft && !hasAccept;

  if (hasAccept) {
    return {
      canEdit: true,
      lockReason: null,
      titleDescriptionCategory: true,
      visibility: false,
      scheduleLocationDuration: false,
      canToggleMood: false,
      moodPresentation: false,
      financial: false,
      canPublish: false,
    };
  }

  return {
    canEdit: true,
    lockReason: null,
    titleDescriptionCategory: true,
    visibility: true,
    scheduleLocationDuration: true,
    canToggleMood,
    moodPresentation: mood && !canToggleMood,
    financial: !hasOffers,
    canPublish: isDraft,
  };
}

export type BuildPatchInput = {
  title: string;
  description: string;
  category: string;
  visibility: PlanVisibility;
  scheduledAt: Date | null;
  locationLabel: string;
  latitude: number | null;
  longitude: number | null;
  durationMinutes: string;
  isMoodPlan: boolean;
  moodType: string;
  moodListingHours: MoodListingHours | null;
  isPaid: boolean;
  startingPriceNgn: string;
  escrowPattern: EscrowPattern | null;
  hostContributionBps: number | null;
};

function clearMoodFields(patch: Record<string, unknown>) {
  patch.is_mood_plan = false;
  patch.mood_type = null;
  patch.mood_expires_at = null;
  patch.mood_start_time = null;
  patch.mood_end_time = null;
  patch.auto_expiry_at = null;
  patch.urgency_level = null;
  patch.negotiation_expires_at = null;
}

function applyMoodPublishFields(
  patch: Record<string, unknown>,
  moodType: string,
  listingHours: MoodListingHours,
  durationMinutes: number | null
) {
  const { scheduledAt, moodExpiresAt } = computePublishedMoodTiming(listingHours);
  const moodExpiresIso = moodExpiresAt.toISOString();

  patch.is_mood_plan = true;
  patch.mood_type = moodType;
  patch.scheduled_at = scheduledAt.toISOString();
  patch.mood_expires_at = moodExpiresIso;
  patch.mood_start_time = scheduledAt.toISOString();
  patch.mood_end_time = moodExpiresIso;
  patch.auto_expiry_at = moodExpiresIso;
  patch.urgency_level = computeUrgencyLevel(moodExpiresAt, scheduledAt);
  patch.negotiation_expires_at = moodNegotiationExpiresAt(true, 2)?.toISOString() ?? null;
  patch.is_expired = false;
  patch.is_paid = false;
  patch.starting_price_cents = null;
  patch.budget_min_cents = null;
  patch.budget_max_cents = null;
  patch.budget_tier = null;
  patch.escrow_pattern = null;
  patch.host_contribution_bps = null;
  if (durationMinutes != null) patch.duration_minutes = durationMinutes;
}

function applyMoodDraftFields(
  patch: Record<string, unknown>,
  moodType: string,
  listingHours: MoodListingHours,
  scheduledAt: Date,
  durationMinutes: number | null
) {
  const moodExpiresAt = computeDraftMoodExpiresAt(listingHours);
  const moodExpiresIso = moodExpiresAt.toISOString();

  patch.is_mood_plan = true;
  patch.mood_type = moodType;
  patch.scheduled_at = scheduledAt.toISOString();
  patch.mood_expires_at = moodExpiresIso;
  patch.mood_start_time = scheduledAt.toISOString();
  patch.mood_end_time = moodExpiresIso;
  patch.auto_expiry_at = moodExpiresIso;
  patch.urgency_level = computeUrgencyLevel(moodExpiresAt, scheduledAt);
  patch.negotiation_expires_at = moodNegotiationExpiresAt(true, 2)?.toISOString() ?? null;
  patch.is_expired = false;
  patch.is_paid = false;
  patch.starting_price_cents = null;
  patch.budget_min_cents = null;
  patch.budget_max_cents = null;
  patch.budget_tier = null;
  patch.escrow_pattern = null;
  patch.host_contribution_bps = null;
  if (durationMinutes != null) patch.duration_minutes = durationMinutes;
}

export function buildCreatorPlanPatch(
  plan: DbPlan,
  offersCount: number,
  form: BuildPatchInput,
  mode: CreatorEditSaveMode = 'update'
): { patch: Record<string, unknown>; error: string | null } {
  const caps = getCreatorEditCapabilities(plan, offersCount);
  if (!caps.canEdit) return { patch: {}, error: caps.lockReason ?? 'Not editable' };

  if (mode === 'publish' && plan.status !== 'draft') {
    return { patch: {}, error: 'Only drafts can be published from here.' };
  }

  if (!plan.meet_type_id && mode === 'publish') {
    return { patch: {}, error: 'This plan is missing a meet type — pick one before publishing.' };
  }

  const patch: Record<string, unknown> = {};
  const isMood = caps.canToggleMood ? form.isMoodPlan : !!plan.is_mood_plan;

  if (caps.titleDescriptionCategory) {
    const t = form.title.trim();
    if (!t) return { patch: {}, error: 'Title is required.' };
    patch.title = t;
    patch.description = form.description.trim() || null;
    patch.category = form.category.trim() || null;
  }

  if (caps.visibility) {
    patch.visibility = form.visibility;
  }

  const dm = parseInt(form.durationMinutes.trim(), 10);
  const durationMinutes = Number.isFinite(dm) && dm > 0 ? dm : null;

  if (caps.scheduleLocationDuration) {
    patch.location_label = form.locationLabel.trim() || null;
    patch.latitude = form.latitude;
    patch.longitude = form.longitude;
    patch.duration_minutes = durationMinutes;

    if (isMood) {
      const scheduledAt = form.scheduledAt ?? new Date(plan.scheduled_at ?? Date.now());
      if (Number.isNaN(scheduledAt.getTime())) {
        return { patch: {}, error: 'Mood plans need a valid start time.' };
      }
      const mt = form.moodType.trim();
      if (!mt) return { patch: {}, error: 'Mood type is required for mood plans.' };
      if (!form.moodListingHours) {
        return { patch: {}, error: 'Choose mood listing hours.' };
      }
      if (mode === 'publish') {
        applyMoodPublishFields(patch, mt, form.moodListingHours, durationMinutes);
      } else {
        applyMoodDraftFields(patch, mt, form.moodListingHours, scheduledAt, durationMinutes);
      }
    } else {
      if (!form.scheduledAt) return { patch: {}, error: 'Set a date and time for the meetup.' };
      patch.scheduled_at = form.scheduledAt.toISOString();
      clearMoodFields(patch);
    }
  } else if (caps.moodPresentation && isMood) {
    const mt = form.moodType.trim();
    if (!mt) return { patch: {}, error: 'Mood type is required for mood plans.' };
    patch.mood_type = mt;
    const schedIso = plan.scheduled_at ?? new Date().toISOString();
    if (plan.mood_expires_at) {
      patch.urgency_level = computeUrgencyLevel(new Date(plan.mood_expires_at), new Date(schedIso));
    }
  }

  if (caps.financial && !isMood) {
    const paid = form.isPaid;
    patch.is_paid = paid;
    if (paid) {
      const raw = form.startingPriceNgn.trim();
      const n = Number(raw);
      const cents = Math.round(n * 100);
      if (!raw || Number.isNaN(n)) return { patch: {}, error: 'Enter a valid price in NGN.' };
      if (cents < MIN_ESCROW_CENTS) {
        return { patch: {}, error: `Minimum paid amount is ₦${MIN_ESCROW_CENTS / 100}.` };
      }
      if (!form.escrowPattern) return { patch: {}, error: 'Choose an escrow pattern.' };
      patch.starting_price_cents = cents;
      patch.budget_min_cents = cents;
      patch.budget_max_cents = cents;
      patch.budget_tier = plan.budget_tier ?? 'mid';
      patch.escrow_pattern = form.escrowPattern;
      patch.host_contribution_bps =
        form.escrowPattern === 'B' ? (form.hostContributionBps ?? 5000) : null;
    } else {
      patch.starting_price_cents = null;
      patch.budget_min_cents = null;
      patch.budget_max_cents = null;
      patch.budget_tier = null;
      patch.escrow_pattern = null;
      patch.host_contribution_bps = null;
    }
  }

  if (mode === 'draft') {
    patch.status = 'draft';
    patch.archived_at = null;
  } else if (mode === 'publish') {
    patch.status = 'negotiating';
    patch.archived_at = null;
    patch.is_expired = false;
  }

  return { patch, error: null };
}
