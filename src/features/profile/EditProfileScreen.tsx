'use client';

import { LocationSearchField } from '@/components/location/LocationSearchField';
import { FormCard } from '@/components/settings/FormCard';
import { GradientChip } from '@/components/settings/GradientChip';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { ToggleRow } from '@/components/settings/ToggleRow';
import { AppStatusDialog } from '@/components/ui/AppStatusDialog';
import { PremiumSectionHead } from '@/features/premium/PremiumSectionHead';
import { HINGE_PROMPTS, INTEREST_TAGS, LANGUAGE_OPTIONS } from '@/lib/onboarding/constants';
import { ageFromBirthDate, draftFromProfile } from '@/lib/onboarding/hydrate';
import { onboardingDraftsEqual } from '@/lib/profile/draftEquals';
import { hasValidProfileLocation } from '@/lib/profile/profileLocation';
import { ProfileMediaManager } from '@/features/profile/ProfileMediaManager';
import { profileMediaMeetsMinimums } from '@/lib/profile/media/validation';
import { draftMediaValidationHint, saveEditProfile } from '@/lib/profile/saveEditProfile';
import { createClient } from '@/lib/supabase/client';
import { setPrimaryPhoto } from '@/lib/profile/media/draft';
import { fetchProfileVideo } from '@/services/profileMedia.service';
import { persistPrimaryPhoto } from '@/services/profilePrimary.service';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth-store';
import type { MeetingIntent } from '@/types/onboarding';
import { defaultOnboardingDraft, type OnboardingDraft } from '@/types/onboarding';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const INTENTS: { id: MeetingIntent; label: string }[] = [
  { id: 'friendship', label: 'Friendship' },
  { id: 'dating', label: 'Dating' },
  { id: 'activity', label: 'Activities' },
  { id: 'networking', label: 'Networking' },
];

export function EditProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<OnboardingDraft>(() => defaultOnboardingDraft());
  const [saving, setSaving] = useState(false);
  const [statusDialog, setStatusDialog] = useState<{
    variant: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['profile-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const client = createClient();
      const bundle = await fetchUserProfileBundle(client, user.id);
      const video = await fetchProfileVideo(client, user.id);
      return { ...bundle, video };
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (data?.profile) setDraft(draftFromProfile(data.profile, data.video));
  }, [data?.profile, data?.video]);

  const savedDraft = useMemo(
    () => (data?.profile ? draftFromProfile(data.profile, data.video) : null),
    [data?.profile, data?.video]
  );

  const isDirty = useMemo(() => {
    if (!savedDraft) return false;
    return !onboardingDraftsEqual(draft, savedDraft);
  }, [draft, savedDraft]);

  const canSave = useMemo(() => {
    const age = ageFromBirthDate(draft.birthDate);
    const filled = draft.promptAnswers.filter((p) => p.answer.trim().length > 0);
    const photos = draft.profileMedia.photos.filter((p) => p.url || p.localFile).length;
    return (
      draft.displayName.trim().length >= 1 &&
      photos >= 1 &&
      age >= 18 &&
      draft.bio.trim().length <= 150 &&
      draft.interests.length >= 1 &&
      draft.languages.length >= 1 &&
      draft.meetingIntent != null &&
      filled.length >= 1 &&
      filled.length <= 2 &&
      hasValidProfileLocation(draft) &&
      profileMediaMeetsMinimums(draft.profileMedia)
    );
  }, [draft]);

  async function save() {
    if (!user?.id || !canSave || !isDirty) return;
    setSaving(true);
    const { error } = await saveEditProfile({
      userId: user.id,
      draft,
      existingPreferences: data?.profile?.preferences ?? null,
      existingVideoMediaId: data?.video?.id,
      existingVideoStoragePath: data?.video?.storagePath,
      requireFullMedia: true,
    });
    if (error) {
      setSaving(false);
      setStatusDialog({
        variant: 'error',
        title: 'Could not save profile',
        message: error,
      });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['profile-bundle'] });
    await queryClient.refetchQueries({ queryKey: ['profile-bundle', user.id] });
    setSaving(false);
    setStatusDialog({
      variant: 'success',
      title: 'Profile saved',
      message: 'Your photos, video, bio, and preferences are updated across LinkUp.',
    });
  }

  function toggleTag(list: 'interests' | 'languages', tag: string) {
    setDraft((d) => {
      const arr = d[list];
      const next = arr.includes(tag) ? arr.filter((x) => x !== tag) : [...arr, tag];
      return { ...d, [list]: next };
    });
  }

  if (!user) {
    return (
      <p className="text-[14px] font-semibold text-muted">
        <Link href="/login" className="font-extrabold text-primary">
          Sign in
        </Link>{' '}
        to edit your profile.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="min-w-0 space-y-4">
        <div className="h-28 animate-pulse rounded-2xl bg-[#EDE8FF]/80" />
        <div className="h-48 animate-pulse rounded-2xl bg-[#FFF0F5]/70" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6 pb-10 min-[400px]:space-y-8">
      <SettingsPageHeader
        kicker="Account"
        title="Edit profile"
        subtitle="Photos, bio, prompts, and preferences, with the same fields as post-onboarding on mobile."
      />

      <FormCard>
        <PremiumSectionHead title="Basics" />
        <label className="mt-3 block text-[13px] font-extrabold">Display name</label>
        <input
          className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-[14px] font-semibold"
          value={draft.displayName}
          onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
        />
        <label className="mt-4 block text-[13px] font-extrabold">Birthday</label>
        <input
          type="date"
          className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-[14px] font-semibold"
          value={draft.birthDate.toISOString().slice(0, 10)}
          onChange={(e) => {
            const [y, m, day] = e.target.value.split('-').map(Number);
            if (y && m && day) setDraft((d) => ({ ...d, birthDate: new Date(y, m - 1, day) }));
          }}
        />
        <label className="mt-4 block text-[13px] font-extrabold">Bio ({draft.bio.length}/150)</label>
        <textarea
          maxLength={150}
          className="mt-1 min-h-[80px] w-full rounded-xl border border-border px-3 py-2.5 text-[14px] font-semibold"
          value={draft.bio}
          onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
        />
        <ToggleRow
          label="Public profile"
          checked={draft.profilePublic}
          onChange={(v) => setDraft((d) => ({ ...d, profilePublic: v }))}
        />
      </FormCard>

      <FormCard>
        <PremiumSectionHead title="Photos & video" />
        <ProfileMediaManager
          className="mt-3"
          media={draft.profileMedia}
          onChange={(profileMedia) => setDraft((d) => ({ ...d, profileMedia }))}
          onPersistPrimary={async (clientId) => {
            if (!user?.id) return;
            const photo = draft.profileMedia.photos.find((p) => p.clientId === clientId);
            if (!photo?.url) return;
            const urls = draft.profileMedia.photos.map((p) => p.url).filter((u): u is string => !!u);
            const { error: pe } = await persistPrimaryPhoto({
              userId: user.id,
              primaryUrl: photo.url,
              allPhotoUrls: urls,
            });
            if (pe) {
              setStatusDialog({
                variant: 'error',
                title: 'Could not update primary photo',
                message: pe,
              });
              return;
            }
            const reordered = setPrimaryPhoto(draft.profileMedia, clientId);
            setDraft((d) => ({
              ...d,
              profileMedia: {
                ...reordered,
                photos: reordered.photos.map((p) => ({
                  ...p,
                  isPrimary: p.clientId === clientId,
                })),
              },
            }));
            await queryClient.invalidateQueries({ queryKey: ['profile-bundle'] });
          }}
        />
        {draftMediaValidationHint(draft) ? (
          <p className="mt-2 text-[12px] font-semibold text-amber-800">{draftMediaValidationHint(draft)}</p>
        ) : null}
      </FormCard>

      <FormCard>
        <PremiumSectionHead title="Location" />
        <LocationSearchField
          value={draft.locationLabel}
          onChange={(label) => setDraft((d) => ({ ...d, locationLabel: label }))}
          onSelect={(s) =>
            setDraft((d) => ({
              ...d,
              locationLabel: s.label,
              locationLatitude: s.latitude,
              locationLongitude: s.longitude,
            }))
          }
        />
      </FormCard>

      <FormCard>
        <PremiumSectionHead title="What you're here for" />
        <div className="mt-2 flex flex-wrap gap-2">
          {INTENTS.map((i) => (
            <GradientChip
              key={i.id}
              label={i.label}
              selected={draft.meetingIntent === i.id}
              onClick={() => setDraft((d) => ({ ...d, meetingIntent: i.id }))}
            />
          ))}
        </div>
      </FormCard>

      <FormCard>
        <PremiumSectionHead title="Interests" />
        <div className="mt-2 flex flex-wrap gap-2">
          {INTEREST_TAGS.map((tag) => (
            <GradientChip
              key={tag}
              label={tag}
              selected={draft.interests.includes(tag)}
              onClick={() => toggleTag('interests', tag)}
            />
          ))}
        </div>
      </FormCard>

      <FormCard>
        <PremiumSectionHead title="Languages" />
        <div className="mt-2 flex flex-wrap gap-2">
          {LANGUAGE_OPTIONS.map((tag) => (
            <GradientChip
              key={tag}
              label={tag}
              selected={draft.languages.includes(tag)}
              onClick={() => toggleTag('languages', tag)}
            />
          ))}
        </div>
      </FormCard>

      <FormCard>
        <PremiumSectionHead title="Prompts (1 to 2)" />
        {draft.promptAnswers.map((p, idx) => (
          <div key={p.promptId} className="mt-4 border-t border-border/60 pt-4 first:mt-0 first:border-0 first:pt-0">
            <select
              className="w-full rounded-xl border border-border px-3 py-2 text-[13px] font-semibold"
              value={p.promptId}
              onChange={(e) => {
                const pr = HINGE_PROMPTS.find((x) => x.id === e.target.value);
                setDraft((d) => {
                  const next = [...d.promptAnswers];
                  next[idx] = { ...next[idx], promptId: e.target.value, prompt: pr?.text ?? '' };
                  return { ...d, promptAnswers: next };
                });
              }}
            >
              {HINGE_PROMPTS.map((hp) => (
                <option key={hp.id} value={hp.id}>
                  {hp.text}
                </option>
              ))}
            </select>
            <textarea
              className="mt-2 w-full rounded-xl border border-border px-3 py-2.5 text-[14px] font-semibold"
              placeholder="Your answer…"
              value={p.answer}
              onChange={(e) => {
                setDraft((d) => {
                  const next = [...d.promptAnswers];
                  next[idx] = { ...next[idx], answer: e.target.value };
                  return { ...d, promptAnswers: next };
                });
              }}
            />
          </div>
        ))}
        {draft.promptAnswers.length < 2 ? (
          <button
            type="button"
            className="mt-3 text-[13px] font-extrabold text-primary"
            onClick={() => {
              const extra = HINGE_PROMPTS.find((h) => !draft.promptAnswers.some((p) => p.promptId === h.id));
              if (extra)
                setDraft((d) => ({
                  ...d,
                  promptAnswers: [
                    ...d.promptAnswers,
                    { promptId: extra.id, prompt: extra.text, answer: '' },
                  ],
                }));
            }}
          >
            Add another prompt
          </button>
        ) : null}
      </FormCard>

      <FormCard>
        <PremiumSectionHead title="Discovery preferences" />
        <p className="text-[13px] font-semibold text-muted">
          Age {draft.ageMin} to {draft.ageMax}, radius {draft.radiusKm} km
        </p>
        <label className="mt-3 block text-[12px] font-extrabold">Min age</label>
        <input
          type="range"
          min={18}
          max={60}
          value={draft.ageMin}
          onChange={(e) => setDraft((d) => ({ ...d, ageMin: Number(e.target.value) }))}
          className="w-full"
        />
        <label className="mt-2 block text-[12px] font-extrabold">Max age</label>
        <input
          type="range"
          min={18}
          max={70}
          value={draft.ageMax}
          onChange={(e) => setDraft((d) => ({ ...d, ageMax: Number(e.target.value) }))}
          className="w-full"
        />
        <label className="mt-2 block text-[12px] font-extrabold">Radius (km)</label>
        <input
          type="range"
          min={5}
          max={100}
          value={draft.radiusKm}
          onChange={(e) => setDraft((d) => ({ ...d, radiusKm: Number(e.target.value) }))}
          className="w-full"
        />
      </FormCard>

      <button
        type="button"
        disabled={saving || !canSave || !isDirty}
        onClick={() => void save()}
        className="w-full min-h-[48px] rounded-full linkup-gradient-primary font-extrabold text-white shadow-md disabled:opacity-50"
      >
        {saving ? 'Saving…' : isDirty ? 'Save profile' : 'No changes to save'}
      </button>

      <AppStatusDialog
        open={statusDialog != null}
        variant={statusDialog?.variant ?? 'success'}
        title={statusDialog?.title ?? ''}
        message={statusDialog?.message ?? ''}
        buttonLabel={statusDialog?.variant === 'error' ? 'OK' : 'Got it'}
        onClose={() => setStatusDialog(null)}
      />
    </div>
  );
}
