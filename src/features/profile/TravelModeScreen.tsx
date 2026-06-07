'use client';

import { LocationSearchField } from '@/components/location/LocationSearchField';
import { FormCard } from '@/components/settings/FormCard';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { PremiumSectionHead } from '@/features/premium/PremiumSectionHead';
import { isPremiumSubscriber } from '@/lib/premium/access';
import { createClient } from '@/lib/supabase/client';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth-store';
import type { ProfilePreferences } from '@/types/database';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { IoAirplane, IoCheckmarkCircle, IoCloseCircle } from 'react-icons/io5';

const PRESETS = [
  { label: 'Lagos', latitude: 6.5244, longitude: 3.3792 },
  { label: 'Abuja', latitude: 9.0765, longitude: 7.3986 },
  { label: 'Port Harcourt', latitude: 4.8156, longitude: 7.0498 },
] as const;

const PAYWALL_POINTS = [
  'Browse meetups as if you were visiting another city.',
  'Plans and distances use your travel pin until you turn it off.',
  'Your home base stays saved in your profile. Turn travel mode off anytime.',
];

type Feedback =
  | { kind: 'saved'; label: string }
  | { kind: 'cleared' }
  | { kind: 'error'; message: string }
  | null;

export function TravelModeScreen() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['profile-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return fetchUserProfileBundle(createClient(), user.id);
    },
    enabled: !!user?.id,
  });

  const profile = data?.profile ?? null;
  const dbUser = data?.dbUser ?? null;
  const premium = isPremiumSubscriber(dbUser);
  const tm = profile?.preferences?.travel_mode;

  useEffect(() => {
    setSearchQuery(tm?.label ?? '');
  }, [tm?.label]);

  const save = useCallback(
    async (next: { label: string; latitude: number; longitude: number } | null) => {
      if (!user?.id) return;
      setSaving(true);
      const client = createClient();
      const prefs: ProfilePreferences = {
        ...(profile?.preferences ?? {}),
        travel_mode: next,
      };
      const { error } = await client.from('profiles').update({ preferences: prefs }).eq('user_id', user.id);
      setSaving(false);
      if (error) setFeedback({ kind: 'error', message: error.message });
      else {
        await queryClient.invalidateQueries({ queryKey: ['profile-bundle'] });
        setFeedback(next ? { kind: 'saved', label: next.label } : { kind: 'cleared' });
      }
    },
    [user?.id, profile?.preferences, queryClient]
  );

  if (!user) {
    return (
      <p className="text-[14px] font-semibold text-muted">
        <Link href="/login" className="font-extrabold text-primary">
          Sign in
        </Link>{' '}
        for travel mode.
      </p>
    );
  }

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-[#EDE8FF]/70" />;
  }

  if (!premium) {
    return (
      <div className="space-y-8 pb-10">
        <SettingsPageHeader
          kicker="Premium"
          title="Travel mode"
          subtitle="Explore another city as if you were there — a Premium feature on LinkUp."
        />
        <div className="rounded-3xl p-[2px] linkup-gradient-primary shadow-lg">
          <div className="rounded-[22px] bg-white px-6 py-8 text-center">
            <IoAirplane size={40} className="mx-auto text-primary" />
            <h2 className="mt-4 font-display text-2xl font-extrabold">Go anywhere on the map</h2>
            <ul className="mt-6 space-y-3 text-left text-[14px] font-semibold text-muted">
              {PAYWALL_POINTS.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className="text-primary">✓</span>
                  {p}
                </li>
              ))}
            </ul>
            <Link
              href="/premium"
              className="mt-8 inline-flex min-h-[48px] items-center justify-center rounded-full linkup-gradient-primary px-8 text-[15px] font-extrabold text-white shadow-md"
            >
              Upgrade to Premium
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader
        kicker="Premium"
        title="Travel mode"
        subtitle="Set a temporary city pin. Discover and distances follow it until you turn it off."
      />

      {feedback ? (
        <div
          className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-[14px] font-extrabold ${
            feedback.kind === 'error'
              ? 'bg-red-500/10 text-red-800'
              : 'bg-emerald-500/10 text-emerald-900'
          }`}
        >
          {feedback.kind === 'error' ? <IoCloseCircle size={22} /> : <IoCheckmarkCircle size={22} />}
          {feedback.kind === 'error'
            ? feedback.message
            : feedback.kind === 'saved'
              ? `Travel pin set to ${feedback.label}`
              : 'Travel mode turned off'}
          <button type="button" className="ml-auto text-[12px] underline" onClick={() => setFeedback(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <FormCard>
        <PremiumSectionHead title="Your travel pin" />
        <LocationSearchField
          label="City or area"
          value={searchQuery}
          onChange={setSearchQuery}
          onSelect={(s) => {
            setSearchQuery(s.label);
            void save({ label: s.label, latitude: s.latitude, longitude: s.longitude });
          }}
          placeholder="Search for a city…"
        />
        {tm?.label ? (
          <p className="mt-3 text-[13px] font-semibold text-muted">
            Active: <span className="font-extrabold text-foreground">{tm.label}</span>
          </p>
        ) : (
          <p className="mt-3 text-[13px] font-semibold text-muted">No travel pin — using your profile location.</p>
        )}
      </FormCard>

      <PremiumSectionHead title="Quick presets" />
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={saving}
            onClick={() => {
              setSearchQuery(p.label);
              void save({ label: p.label, latitude: p.latitude, longitude: p.longitude });
            }}
            className="rounded-full border border-border bg-white px-4 py-2 text-[13px] font-extrabold text-primary hover:border-primary/40 disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
      </div>

      {tm ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setSearchQuery('');
            void save(null);
          }}
          className="w-full min-h-[48px] rounded-full border-2 border-primary/30 font-extrabold text-primary disabled:opacity-50"
        >
          Turn off travel mode
        </button>
      ) : null}
    </div>
  );
}
