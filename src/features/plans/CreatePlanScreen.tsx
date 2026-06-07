'use client';

import { LocationSearchField } from '@/components/location/LocationSearchField';
import { ToggleSwitch } from '@/components/settings/ToggleRow';
import { Input } from '@/components/ui/Input';
import { PremiumSectionHead } from '@/features/premium/PremiumSectionHead';
import { isPremiumSubscriber } from '@/lib/premium/access';
import type { MoodListingHours } from '@/lib/plans/moodPlanComputations';
import { createClient } from '@/lib/supabase/client';
import type { LocationSuggestion } from '@/lib/location/types';
import { requiresVerificationGate } from '@/lib/verification/access';
import { fetchActiveMeetTypes } from '@/services/meetTypes.service';
import { publishPlan } from '@/services/publishPlan.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth-store';
import type { DbMeetType, EscrowPattern } from '@/types/database';
import { cn } from '@/utils/cn';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { IoArrowBack, IoSparkles } from 'react-icons/io5';

const DURATIONS = [
  { m: 30, label: '30m' },
  { m: 60, label: '1h' },
  { m: 90, label: '1.5h' },
  { m: 120, label: '2h' },
  { m: 180, label: '3h+' },
] as const;

const MOOD_TYPES = ['Chill', 'Active', 'Social', 'Premium vibe'] as const;

const VISIBILITY = [
  { value: 'public' as const, title: 'Public', description: 'Anyone on LinkUp can discover this plan.' },
  { value: 'radius' as const, title: 'Within radius', description: 'Shown within your discovery radius.' },
  { value: 'friends' as const, title: 'Friends only', description: 'Connections only when friends ship.' },
];

const ESCROW: { id: EscrowPattern; label: string; sub: string }[] = [
  { id: 'A', label: 'Host funds', sub: 'You back the invite' },
  { id: 'B', label: 'Split', sub: 'Both contribute' },
  { id: 'C', label: 'Guest funds', sub: 'Tier 2 KYC' },
];

function defaultScheduled(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(19, 0, 0, 0);
  return d;
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CreatePlanScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [meetTypeId, setMeetTypeId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledLocal, setScheduledLocal] = useState(() => toLocalInputValue(defaultScheduled()));
  const [durationMinutes, setDurationMinutes] = useState<number | null>(60);
  const [locationLabel, setLocationLabel] = useState('');
  const [coords, setCoords] = useState<LocationSuggestion | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'radius' | 'friends'>('public');
  const [isMoodPlan, setIsMoodPlan] = useState(false);
  const [moodType, setMoodType] = useState<string>(MOOD_TYPES[0]);
  const [moodListingHours, setMoodListingHours] = useState<MoodListingHours>(3);
  const [isPaid, setIsPaid] = useState(true);
  const [startingPriceNgn, setStartingPriceNgn] = useState('');
  const [escrowPattern, setEscrowPattern] = useState<EscrowPattern>('A');
  const [spotlightBoost, setSpotlightBoost] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: profileBundle } = useQuery({
    queryKey: ['profile-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return fetchUserProfileBundle(createClient(), user.id);
    },
    enabled: !!user?.id,
  });

  const premium = isPremiumSubscriber(profileBundle?.dbUser ?? null);
  const verificationBlocked = requiresVerificationGate(
    profileBundle?.dbUser?.verification_status,
    { verifiedBadge: profileBundle?.profile?.verified_badge }
  );

  const { data: meetTypes } = useQuery({
    queryKey: ['meet-types'],
    queryFn: async () => {
      const { rows, error: err } = await fetchActiveMeetTypes(createClient());
      if (err) throw new Error(err);
      return rows;
    },
  });

  const selectedMeetType = useMemo(
    () => meetTypes?.find((m) => m.id === meetTypeId) ?? null,
    [meetTypes, meetTypeId]
  );

  async function handlePublish() {
    setError(null);
    if (verificationBlocked) {
      setError('Complete verification in Trust settings before publishing.');
      return;
    }
    if (!user?.id) return;
    if (!meetTypeId) {
      setError('Pick a meet type.');
      return;
    }

    const scheduledAt = isMoodPlan ? new Date() : new Date(scheduledLocal);
    if (Number.isNaN(scheduledAt.getTime())) {
      setError('Set a valid date and time.');
      return;
    }

    setBusy(true);
    const { planId, error: pubErr } = await publishPlan(createClient(), user.id, {
      meetTypeId,
      title,
      description,
      locationLabel,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      scheduledAt,
      durationMinutes,
      visibility,
      isPaid: isMoodPlan ? false : isPaid,
      startingPriceNgn,
      escrowPattern: isPaid ? escrowPattern : null,
      hostContributionBps: 5000,
      isMoodPlan,
      moodType,
      moodListingHours,
      spotlightBoost,
      premiumSubscriber: premium,
    });
    setBusy(false);

    if (pubErr) {
      setError(pubErr);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['creator-plans'] });
    await queryClient.invalidateQueries({ queryKey: ['discover'] });
    if (planId) router.push(`/plan/${planId}`);
    else router.push('/plan-management');
  }

  if (!user) {
    return (
      <p className="text-[14px] font-semibold text-muted">
        <Link href="/login" className="font-extrabold text-primary">
          Sign in
        </Link>{' '}
        to create a plan.
      </p>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center gap-4">
        <Link
          href="/plan-management"
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-white/90 shadow-sm transition hover:bg-[#EDE8FF]/60"
          aria-label="Back to plan management"
        >
          <IoArrowBack size={22} />
        </Link>
        <header>
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">New meetup</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">Create plan</h1>
        </header>
      </div>

      {verificationBlocked ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] font-semibold text-amber-900">
          Verification required before publishing.{' '}
          <Link href="/trust" className="font-extrabold text-primary underline">
            Complete trust & verification
          </Link>
        </p>
      ) : null}

      <PremiumSectionHead title="When & how you'll meet" />

      <div className="linkup-card space-y-4 p-5">
        <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Meet type</p>
        <div className="flex flex-wrap gap-2">
          {(meetTypes ?? []).map((mt: DbMeetType) => (
            <button
              key={mt.id}
              type="button"
              onClick={() => {
                setMeetTypeId(mt.id);
                if (!durationMinutes && mt.default_duration_minutes) {
                  setDurationMinutes(mt.default_duration_minutes);
                }
              }}
              className={cn(
                'rounded-full px-4 py-2 text-[13px] font-extrabold transition',
                meetTypeId === mt.id
                  ? 'linkup-gradient-primary text-white shadow-sm'
                  : 'border border-border bg-white text-primary hover:border-primary/30'
              )}
            >
              {mt.name}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-secondary/20 bg-secondary/5 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[15px] font-extrabold text-foreground">Mood plan</p>
            <p className="text-[13px] font-semibold text-muted">Short-lived spark in Discover</p>
          </div>
          <ToggleSwitch
            id="mood-plan"
            checked={isMoodPlan}
            onChange={setIsMoodPlan}
            disabled={selectedMeetType != null && !selectedMeetType.supports_mood}
          />
        </div>

        {isMoodPlan ? (
          <div className="space-y-3">
            <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Mood label</p>
            <div className="flex flex-wrap gap-2">
              {MOOD_TYPES.map((m) => (
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
            <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Listing hours</p>
            <div className="flex flex-wrap gap-2">
              {([1, 3, 6, 12] as MoodListingHours[]).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setMoodListingHours(h)}
                  className={cn(
                    'rounded-full px-3 py-2 text-[13px] font-extrabold',
                    moodListingHours === h ? 'linkup-gradient-primary text-white' : 'bg-primary/10 text-primary'
                  )}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>
        ) : (
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
        )}

        <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Duration</p>
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d.m}
              type="button"
              onClick={() => setDurationMinutes(d.m)}
              className={cn(
                'rounded-full px-4 py-2 text-[13px] font-extrabold',
                durationMinutes === d.m ? 'linkup-gradient-primary text-white' : 'bg-primary/10 text-primary'
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <PremiumSectionHead title="Story & place" />

      <div className="linkup-card space-y-4 p-5">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Dinner in Lekki tonight"
        />
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-extrabold uppercase tracking-wide text-muted">
            Description
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="What should people expect?"
            className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-[15px] font-semibold outline-none focus:border-primary/40"
          />
        </label>
        <LocationSearchField
          label="Location"
          value={locationLabel}
          onChange={setLocationLabel}
          onSelect={(s) => setCoords(s)}
          placeholder="Search with Google Places…"
        />
      </div>

      <PremiumSectionHead title="Visibility" />

      <div className="space-y-2" role="radiogroup" aria-label="Plan visibility">
        {VISIBILITY.map((opt) => {
          const selected = visibility === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setVisibility(opt.value)}
              className={cn(
                'w-full rounded-2xl border-2 p-4 text-left transition active:scale-[0.995]',
                selected
                  ? 'border-primary bg-[#EDE8FF]/70 shadow-md ring-2 ring-primary/25'
                  : 'border-border bg-white hover:border-primary/30 hover:bg-[#F8F7FF]/80'
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className={cn('text-[15px] font-extrabold', selected ? 'text-primary' : 'text-foreground')}>
                  {opt.title}
                </p>
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    selected ? 'border-primary bg-primary' : 'border-border bg-white'
                  )}
                  aria-hidden
                >
                  {selected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                </span>
              </div>
              <p className="mt-1 text-[13px] font-semibold text-muted">{opt.description}</p>
            </button>
          );
        })}
      </div>

      {!isMoodPlan ? (
        <>
          <PremiumSectionHead title="Commitment & escrow" />
          <div className="linkup-card space-y-4 p-5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[15px] font-extrabold text-foreground">Paid plan</span>
              <ToggleSwitch id="paid-plan" checked={isPaid} onChange={setIsPaid} />
            </div>
            {isPaid ? (
              <>
                <Input
                  label="Starting price (NGN)"
                  value={startingPriceNgn}
                  onChange={(e) => setStartingPriceNgn(e.target.value)}
                  inputMode="decimal"
                />
                <div className="grid gap-2 sm:grid-cols-3">
                  {ESCROW.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setEscrowPattern(e.id)}
                      className={cn(
                        'rounded-2xl border p-3 text-left',
                        escrowPattern === e.id
                          ? 'border-primary/40 bg-[#EDE8FF]/50'
                          : 'border-border hover:border-primary/20'
                      )}
                    >
                      <p className="text-[14px] font-extrabold text-foreground">{e.label}</p>
                      <p className="text-[12px] font-semibold text-muted">{e.sub}</p>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </>
      ) : null}

      {premium ? (
        <div className="linkup-card flex items-center gap-3 p-4">
          <IoSparkles className="shrink-0 text-primary" size={22} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-extrabold text-foreground">Spotlight boost</p>
            <p className="text-[13px] font-semibold text-muted">Extra feed placement while publishing</p>
          </div>
          <ToggleSwitch id="spotlight-boost" checked={spotlightBoost} onChange={setSpotlightBoost} />
        </div>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[14px] font-semibold text-[#EF4444]">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy || verificationBlocked}
        onClick={() => void handlePublish()}
        className="flex w-full min-h-[56px] items-center justify-center rounded-full linkup-gradient-primary text-[17px] font-extrabold text-white shadow-lg transition hover:opacity-95 disabled:opacity-45"
      >
        {busy ? 'Publishing…' : 'Publish plan'}
      </button>

      <p className="text-center text-[13px] font-semibold text-muted">
        Uses the same <span className="font-extrabold text-primary">publish_plan</span> RPC as the mobile app.
      </p>
    </div>
  );
}
