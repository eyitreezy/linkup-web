'use client';

import { LocationSearchField } from '@/components/location/LocationSearchField';
import { ToggleSwitch } from '@/components/settings/ToggleRow';
import { Input } from '@/components/ui/Input';
import {
  buildCreatorPlanPatch,
  getCreatorEditCapabilities,
  type BuildPatchInput,
  type CreatorEditSaveMode,
} from '@/lib/plans/planCreatorEditPolicy';
import type { MoodListingHours } from '@/lib/plans/moodPlanComputations';
import {
  deriveMoodListingHours,
  MOOD_LISTING_HOUR_OPTIONS,
  MOOD_TYPE_OPTIONS,
} from '@/lib/plans/moodPlanUi';
import type { CreatorPlanRow } from '@/lib/plans/planManagement';
import type { LocationSuggestion } from '@/lib/location/types';
import { useGatedAction } from '@/contexts/UpgradeGateContext';
import { moodLive } from '@/lib/plans/planManagement';
import { requiresVerificationGate } from '@/lib/verification/access';
import { createClient } from '@/lib/supabase/client';
import { updateCreatorPlan } from '@/services/planManagement.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import type { DbPlan, EscrowPattern } from '@/types/database';
import { cn } from '@/utils/cn';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { useEffect, useMemo, useState } from 'react';
import { IoClose } from 'react-icons/io5';

const VISIBILITY_OPTIONS: { value: DbPlan['visibility']; title: string; description: string }[] = [
  { value: 'public', title: 'Public', description: 'Anyone on LinkUp can discover this plan.' },
  { value: 'radius', title: 'Within radius', description: 'Shown within your discovery radius.' },
  { value: 'friends', title: 'Friends only', description: 'Connections only (when friends ship).' },
];

const ESCROW: { id: EscrowPattern; label: string }[] = [
  { id: 'A', label: 'Host funds' },
  { id: 'B', label: 'Split' },
  { id: 'C', label: 'Guest funds' },
];

type Props = {
  plan: CreatorPlanRow | null;
  offersCount: number;
  onClose: () => void;
  onSaved: () => void;
};

function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PlanCreatorEditModal({ plan, offersCount, onClose, onSaved }: Props) {
  const user = useAuthStore((s) => s.user);
  const caps = useMemo(
    () => (plan ? getCreatorEditCapabilities(plan, offersCount) : null),
    [plan, offersCount]
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [visibility, setVisibility] = useState<DbPlan['visibility']>('public');
  const [scheduledLocal, setScheduledLocal] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [coords, setCoords] = useState<LocationSuggestion | null>(null);
  const [durationMinutes, setDurationMinutes] = useState('');
  const [isMoodPlan, setIsMoodPlan] = useState(false);
  const [moodType, setMoodType] = useState('');
  const [moodListingHours, setMoodListingHours] = useState<MoodListingHours>(3);
  const [isPaid, setIsPaid] = useState(false);
  const [startingPriceNgn, setStartingPriceNgn] = useState('');
  const [escrowPattern, setEscrowPattern] = useState<EscrowPattern | null>('A');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runGated = useGatedAction();

  const { data: profileBundle } = useQuery({
    queryKey: ['profile-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return fetchUserProfileBundle(createClient(), user.id);
    },
    enabled: !!user?.id,
  });

  const verificationBlocked = requiresVerificationGate(
    profileBundle?.dbUser?.verification_status,
    { verifiedBadge: profileBundle?.profile?.verified_badge }
  );

  useEffect(() => {
    if (!plan) return;
    setTitle(plan.title ?? '');
    setDescription(plan.description ?? '');
    setCategory(plan.category ?? '');
    setVisibility(plan.visibility);
    setScheduledLocal(toLocalInputValue(plan.scheduled_at));
    setLocationLabel(plan.location_label ?? '');
    setCoords(
      plan.latitude != null && plan.longitude != null
        ? {
            placeId: '',
            label: plan.location_label ?? '',
            latitude: plan.latitude,
            longitude: plan.longitude,
          }
        : null
    );
    setDurationMinutes(plan.duration_minutes != null ? String(plan.duration_minutes) : '');
    setIsMoodPlan(!!plan.is_mood_plan);
    setMoodType(plan.mood_type ?? MOOD_TYPE_OPTIONS[0]);
    setMoodListingHours(plan.is_mood_plan ? deriveMoodListingHours(plan) : 3);
    setIsPaid(!!plan.is_paid);
    setStartingPriceNgn(
      plan.starting_price_cents != null ? String(plan.starting_price_cents / 100) : ''
    );
    setEscrowPattern(plan.escrow_pattern ?? 'A');
    setError(null);
  }, [plan]);

  if (!plan || !caps) return null;

  const activePlan = plan;
  const activeCaps = caps;
  const isDraft = activePlan.status === 'draft';
  const showMoodFields = activeCaps.canToggleMood
    ? isMoodPlan
    : activeCaps.moodPresentation && activePlan.is_mood_plan;
  const showDateTime = activeCaps.canToggleMood ? !isMoodPlan : !activePlan.is_mood_plan;
  const meetTypeMoodHint =
    activePlan.meet_types != null && activePlan.meet_types.supports_mood === false;

  function buildForm(): BuildPatchInput {
    const moodActive = activeCaps.canToggleMood ? isMoodPlan : !!activePlan.is_mood_plan;
    const scheduledAt = moodActive
      ? new Date()
      : scheduledLocal
        ? new Date(scheduledLocal)
        : null;

    return {
      title,
      description,
      category,
      visibility,
      scheduledAt,
      locationLabel,
      latitude: coords?.latitude ?? activePlan.latitude,
      longitude: coords?.longitude ?? activePlan.longitude,
      durationMinutes,
      isMoodPlan: moodActive,
      moodType,
      moodListingHours: moodActive ? moodListingHours : null,
      isPaid,
      startingPriceNgn,
      escrowPattern: isPaid ? escrowPattern : null,
      hostContributionBps: activePlan.host_contribution_bps ?? 5000,
    };
  }

  async function save(mode: CreatorEditSaveMode) {
    setError(null);

    if (mode === 'publish' && verificationBlocked) {
      setError('Complete verification in Trust settings before publishing.');
      return;
    }

    const form = buildForm();
    const { patch, error: patchErr } = buildCreatorPlanPatch(activePlan, offersCount, form, mode);
    if (patchErr) {
      setError(patchErr);
      return;
    }

    setBusy(true);
    const client = createClient();
    const { error: upErr } = await updateCreatorPlan(client, activePlan.id, patch);
    setBusy(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-sm p-0 sm:p-2">
      <div className="flex h-full w-full max-w-lg flex-col bg-surface shadow-2xl sm:max-h-[100dvh] sm:rounded-l-2xl">
        <div className="flex items-center justify-between border-b border-border px-3 py-3 min-[425px]:px-5 min-[425px]:py-4">
          <div>
            <h2 className="font-display text-lg font-extrabold text-foreground min-[425px]:text-xl">
              {isDraft ? 'Edit draft' : 'Edit plan'}
            </h2>
            {isDraft ? (
              <p className="mt-0.5 text-[13px] font-semibold text-muted">
                Save as draft or publish when you&apos;re ready.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-[#EDE8FF]/60"
            aria-label="Close"
          >
            <IoClose size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain space-y-4 px-3 py-4 min-[425px]:px-5 min-[425px]:py-5">
          {!activeCaps.canEdit ? (
            <p className="rounded-2xl bg-[#FEF2F2] px-4 py-3 text-[14px] font-semibold text-[#EF4444]">
              {activeCaps.lockReason}
            </p>
          ) : null}

          {verificationBlocked && activeCaps.canPublish ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] font-semibold text-amber-900">
              Verification is required before you can publish.
            </p>
          ) : null}

          {activeCaps.titleDescriptionCategory ? (
            <>
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-extrabold uppercase tracking-wide text-muted">
                  Description
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-[15px] font-semibold text-foreground outline-none focus:border-primary/40"
                />
              </label>
              <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
              <p className="-mt-2 text-[12px] font-semibold leading-snug text-muted">
                Optional legacy tag for plan-management search. Activity type is set by meet type; mood
                plans use mood type. Not shown in Discover filters.
              </p>
            </>
          ) : null}

          {activeCaps.visibility ? (
            <div className="space-y-2" role="radiogroup" aria-label="Visibility">
              <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Visibility</p>
              {VISIBILITY_OPTIONS.map((opt) => {
                const selected = visibility === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setVisibility(opt.value)}
                    className={cn(
                      'w-full rounded-2xl border-2 p-4 text-left transition',
                      selected
                        ? 'border-primary bg-[#EDE8FF]/70 shadow-md ring-2 ring-primary/25'
                        : 'border-border bg-white hover:border-primary/30'
                    )}
                  >
                    <p className={cn('text-[15px] font-extrabold', selected ? 'text-primary' : 'text-foreground')}>
                      {opt.title}
                    </p>
                    <p className="mt-1 text-[13px] font-semibold text-muted">{opt.description}</p>
                  </button>
                );
              })}
            </div>
          ) : null}

          {activeCaps.canToggleMood ? (
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-secondary/20 bg-secondary/5 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-[15px] font-extrabold text-foreground">Mood plan</p>
                <p className="text-[13px] font-semibold text-muted">Short-lived spark in Discover</p>
              </div>
              <ToggleSwitch
                id="edit-mood-plan"
                checked={isMoodPlan}
                onChange={setIsMoodPlan}
              />
            </div>
          ) : null}

          {activeCaps.canToggleMood && meetTypeMoodHint && isMoodPlan ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-900">
              This meet type is usually for scheduled plans. You can still save as a mood draft and
              publish when ready.
            </p>
          ) : null}

          {showMoodFields ? (
            <div className="space-y-4 rounded-2xl border border-secondary/20 bg-secondary/5 p-4">
              {!activeCaps.canToggleMood ? (
                <div>
                  <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Mood plan</p>
                  <p className="mt-1 text-[13px] font-semibold text-muted">
                    Short-lived spark in Discover. Starts when you publish.
                  </p>
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Mood label</p>
                <div className="flex flex-wrap gap-2">
                  {MOOD_TYPE_OPTIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMoodType(m)}
                      className={cn(
                        'rounded-full px-3 py-2 text-[13px] font-extrabold',
                        moodType === m ? 'bg-secondary/15 text-secondary' : 'bg-primary/5 text-muted'
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Listing hours</p>
                <div className="flex flex-wrap gap-2">
                  {MOOD_LISTING_HOUR_OPTIONS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setMoodListingHours(h)}
                      className={cn(
                        'rounded-full px-3 py-2 text-[13px] font-extrabold',
                        moodListingHours === h
                          ? 'linkup-gradient-primary text-white'
                          : 'bg-primary/10 text-primary'
                      )}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
                <p className="text-[12px] font-semibold text-muted">
                  How long your mood stays visible after publishing.
                </p>
                {plan && plan.is_mood_plan && moodLive(plan) ? (
                  <button
                    type="button"
                    className="mt-2 rounded-full border border-secondary/30 bg-white px-4 py-2 text-[13px] font-extrabold text-secondary"
                    onClick={() => {
                      void runGated('mood_plan.extend', () => {
                        setMoodListingHours((h) => (h < 12 ? ((h + 3) as MoodListingHours) : 12));
                      });
                    }}
                  >
                    Extend mood window
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeCaps.scheduleLocationDuration ? (
            <>
              {showDateTime ? (
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-extrabold uppercase tracking-wide text-muted">
                    Date & time
                  </span>
                  <input
                    type="datetime-local"
                    value={scheduledLocal}
                    onChange={(e) => setScheduledLocal(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-[15px] font-semibold"
                  />
                </label>
              ) : null}
              <LocationSearchField
                label="Location"
                value={locationLabel}
                onChange={(label) => {
                  setLocationLabel(label);
                  setCoords((prev) => (prev && label !== prev.label ? null : prev));
                }}
                onSelect={(s) => setCoords(s)}
                placeholder="Search with Google Places…"
              />
              <Input
                label="Duration (minutes)"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                inputMode="numeric"
              />
            </>
          ) : null}

          {activeCaps.financial && showDateTime ? (
            <div className="space-y-3 rounded-2xl border border-border p-4">
              <label className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-extrabold text-foreground">Paid plan</span>
                <input
                  type="checkbox"
                  checked={isPaid}
                  onChange={(e) => setIsPaid(e.target.checked)}
                  className="h-5 w-5 accent-primary"
                />
              </label>
              {isPaid ? (
                <>
                  <Input
                    label="Starting price (NGN)"
                    value={startingPriceNgn}
                    onChange={(e) => setStartingPriceNgn(e.target.value)}
                    inputMode="decimal"
                  />
                  <div className="flex flex-wrap gap-2">
                    {ESCROW.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => {
                          if (e.id === 'B') void runGated('escrow.pattern_b', () => setEscrowPattern(e.id));
                          else if (e.id === 'C') void runGated('escrow.pattern_c', () => setEscrowPattern(e.id));
                          else setEscrowPattern(e.id);
                        }}
                        className={cn(
                          'rounded-full px-3 py-2 text-[13px] font-extrabold',
                          escrowPattern === e.id
                            ? 'linkup-gradient-primary text-white'
                            : 'bg-primary/10 text-primary'
                        )}
                      >
                        {e.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="text-[14px] font-semibold text-[#EF4444]">{error}</p>
          ) : null}
        </div>

        <div className="border-t border-border p-3 min-[425px]:p-5">
          {activeCaps.canPublish ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={busy || !activeCaps.canEdit}
                onClick={() => void save('draft')}
                className="flex min-h-[48px] flex-1 items-center justify-center rounded-full border border-primary/25 bg-white text-[15px] font-extrabold text-primary transition hover:bg-[#EDE8FF]/50 disabled:opacity-45"
              >
                {busy ? 'Saving…' : 'Save draft'}
              </button>
              <button
                type="button"
                disabled={busy || !activeCaps.canEdit || verificationBlocked}
                onClick={() => void save('publish')}
                className="flex min-h-[48px] flex-1 items-center justify-center rounded-full linkup-gradient-primary text-[15px] font-extrabold text-white shadow-md transition hover:opacity-95 disabled:opacity-45"
              >
                {busy ? 'Publishing…' : 'Publish plan'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy || !activeCaps.canEdit}
              onClick={() => void save('update')}
              className="flex w-full min-h-[48px] items-center justify-center rounded-full linkup-gradient-primary text-[15px] font-extrabold text-white shadow-md disabled:opacity-45"
            >
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
