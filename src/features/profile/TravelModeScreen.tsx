'use client';

import { LocationSearchField } from '@/components/location/LocationSearchField';
import { FormCard } from '@/components/settings/FormCard';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { PremiumSectionHead } from '@/features/premium/PremiumSectionHead';
import { usePermission } from '@/hooks/usePermission';
import { travelPresetsForProfile } from '@/lib/travel/travelPresets';
import { getRecentTravelCities, recordTravelCity, type RecentTravelCity } from '@/lib/travel/recentTravelCities';
import { createClient } from '@/lib/supabase/client';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth-store';
import type { ProfilePreferences } from '@/types/database';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { IoAirplane, IoCheckmarkCircle, IoCloseCircle, IoTimeOutline } from 'react-icons/io5';

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
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [saving, setSaving] = useState(false);
  const [recentCities, setRecentCities] = useState<RecentTravelCity[]>([]);

  useEffect(() => {
    setRecentCities(getRecentTravelCities());
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['profile-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return fetchUserProfileBundle(createClient(), user.id);
    },
    enabled: !!user?.id,
  });

  const profile = data?.profile ?? null;
  const presets = useMemo(() => travelPresetsForProfile(profile), [profile]);
  const { allowed: travelAllowed, loading: travelPermLoading } = usePermission('discover.travel_mode');
  const tm = profile?.preferences?.travel_mode;

  useEffect(() => {
    setSearchQuery(tm?.label ?? '');
  }, [tm?.label]);

  const save = useCallback(
    async (next: { label: string; latitude: number; longitude: number } | null) => {
      if (!user?.id) return;
      setSaving(true);
      const client = createClient();
      const payload = next
        ? {
            label: next.label,
            latitude: next.latitude,
            longitude: next.longitude,
            set_at: new Date().toISOString(),
          }
        : null;
      const prefs: ProfilePreferences = {
        ...(profile?.preferences ?? {}),
        travel_mode: payload,
      };
      const { error } = await client.from('profiles').update({ preferences: prefs }).eq('user_id', user.id);
      setSaving(false);
      if (error) setFeedback({ kind: 'error', message: error.message });
      else {
        if (next) recordTravelCity(next);
        setRecentCities(getRecentTravelCities());
        await queryClient.invalidateQueries({ queryKey: ['profile-bundle'] });
        await queryClient.invalidateQueries({ queryKey: ['discover'] });
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

  if (isLoading || travelPermLoading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-[#EDE8FF]/70" />;
  }

  if (!travelAllowed) {
    return (
      <div className="space-y-8 pb-10">
        <SettingsPageHeader
          kicker="Gold"
          title="Travel mode"
          subtitle="Explore another city as if you were there with Gold Explorer on LinkUp."
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
              href="/subscription?tier=GOLD"
              className="mt-8 inline-flex min-h-[48px] items-center justify-center rounded-full linkup-gradient-primary px-8 text-[15px] font-extrabold text-white shadow-md"
            >
              Upgrade to Gold
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader
        kicker="Gold"
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

      {recentCities.filter((c) => c.label !== tm?.label).length > 0 ? (
        <div>
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">
            Recently visited
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {recentCities
              .filter((c) => c.label !== tm?.label)
              .slice(0, 3)
              .map((city) => (
                <button
                  key={city.label}
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setSearchQuery(city.label);
                    void save({
                      label: city.label,
                      latitude: city.latitude,
                      longitude: city.longitude,
                    });
                  }}
                  className="flex min-h-[48px] items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 text-left text-[13px] font-extrabold text-foreground transition hover:border-primary/40 disabled:opacity-50"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <IoTimeOutline size={14} className="shrink-0 text-muted" />
                    <span className="truncate">{city.label.split(',')[0].trim()}</span>
                  </div>
                  <span className="ml-2 shrink-0 text-[11px] font-bold text-primary">Use</span>
                </button>
              ))}
          </div>
        </div>
      ) : null}

      <PremiumSectionHead title="Quick presets" />
      <div className="grid gap-2 sm:grid-cols-2">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={saving}
            onClick={() => {
              setSearchQuery(p.label);
              void save({ label: p.label, latitude: p.latitude, longitude: p.longitude });
            }}
            className="flex min-h-[48px] items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 text-left text-[13px] font-extrabold text-foreground transition hover:border-primary/40 disabled:opacity-50"
          >
            <span>{p.label}</span>
            <span className="text-[11px] font-bold text-primary">Use</span>
          </button>
        ))}
      </div>

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
          <p className="mt-3 text-[13px] font-semibold text-muted">No travel pin. Using your profile home location.</p>
        )}
      </FormCard>

      {tm ? (
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push('/discover')}
            className="min-h-[52px] flex-1 rounded-full linkup-gradient-primary text-[15px] font-extrabold text-white shadow-md"
          >
            Go to Discover
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setSearchQuery('');
              void save(null);
            }}
            className="min-h-[52px] flex-1 rounded-full border border-border bg-white text-[14px] font-extrabold text-muted transition hover:border-red-200 hover:text-red-700 disabled:opacity-50"
          >
            Turn off travel mode
          </button>
        </div>
      ) : null}
    </div>
  );
}
