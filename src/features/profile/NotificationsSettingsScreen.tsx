'use client';

import { FormCard } from '@/components/settings/FormCard';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { ToggleRow } from '@/components/settings/ToggleRow';
import { PremiumSectionHead } from '@/features/premium/PremiumSectionHead';
import { defaultVisibilityPrefs, readVisibilityFromProfile } from '@/lib/presence/visibilityPrefs';
import { createClient } from '@/lib/supabase/client';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth-store';
import type { ProfilePreferences } from '@/types/database';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

export function NotificationsSettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(true);
  const [showOnline, setShowOnline] = useState(true);
  const [showLastSeen, setShowLastSeen] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [shareTyping, setShareTyping] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['profile-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return fetchUserProfileBundle(createClient(), user.id);
    },
    enabled: !!user?.id,
  });

  const profile = data?.profile ?? null;

  useEffect(() => {
    const n = profile?.preferences?.notifications;
    if (n) {
      setPush(n.push !== false);
      setEmail(n.email !== false);
    }
    const v = readVisibilityFromProfile(profile?.preferences);
    setShowOnline(v.showOnline);
    setShowLastSeen(v.showLastSeen);
    setReadReceipts(v.readReceipts);
    setShareTyping(v.shareTyping);
  }, [profile?.preferences]);

  const saveAll = useCallback(
    async (next: {
      push: boolean;
      email: boolean;
      showOnline: boolean;
      showLastSeen: boolean;
      readReceipts: boolean;
      shareTyping: boolean;
    }) => {
      if (!user?.id) return;
      setSaving(true);
      setError(null);
      const visibility: NonNullable<ProfilePreferences['visibility']> = {
        ...defaultVisibilityPrefs(),
        ...(profile?.preferences?.visibility ?? {}),
        show_online_status: next.showOnline,
        show_last_seen: next.showLastSeen,
        read_receipts: next.readReceipts,
        share_typing_indicator: next.shareTyping,
      };
      const base = profile?.preferences ?? {};
      const nextPrefs: ProfilePreferences = {
        ...base,
        notifications: { push: next.push, email: next.email },
        visibility,
      };
      const client = createClient();
      const { error: err } = await client
        .from('profiles')
        .update({ preferences: nextPrefs })
        .eq('user_id', user.id);
      setSaving(false);
      if (err) setError(err.message);
      else await queryClient.invalidateQueries({ queryKey: ['profile-bundle'] });
    },
    [user?.id, profile?.preferences, queryClient]
  );

  const patch = (partial: Partial<Parameters<typeof saveAll>[0]>) => {
    const next = {
      push,
      email,
      showOnline,
      showLastSeen,
      readReceipts,
      shareTyping,
      ...partial,
    };
    void saveAll(next);
  };

  if (!user) {
    return (
      <p className="text-[14px] font-semibold text-muted">
        <Link href="/login" className="font-extrabold text-primary">
          Sign in
        </Link>{' '}
        to manage notification settings.
      </p>
    );
  }

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-[#EDE8FF]/70" />;
  }

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader
        kicker="Preferences"
        title="Notifications & visibility"
        subtitle="Define how we notify you and how you present yourself to everyone on LinkUp."
      />

      {error ? <p className="text-[14px] font-extrabold text-red-600">{error}</p> : null}
      {saving ? <p className="text-[12px] font-semibold text-muted">Saving…</p> : null}

      <PremiumSectionHead title="Notifications" />
      <FormCard>
        <ToggleRow
          label="Push notifications"
          hint="Meetups, messages, and escrow on this device (when supported)."
          checked={push}
          onChange={(v) => {
            setPush(v);
            patch({ push: v });
          }}
        />
        <ToggleRow
          label="Email notifications"
          hint="Important account and payment updates."
          checked={email}
          onChange={(v) => {
            setEmail(v);
            patch({ email: v });
          }}
        />
      </FormCard>

      <PremiumSectionHead title="Visibility" />
      <FormCard>
        <ToggleRow
          label="Show online status"
          checked={showOnline}
          onChange={(v) => {
            setShowOnline(v);
            patch({ showOnline: v });
          }}
        />
        <ToggleRow
          label="Show last seen"
          checked={showLastSeen}
          onChange={(v) => {
            setShowLastSeen(v);
            patch({ showLastSeen: v });
          }}
        />
        <ToggleRow
          label="Read receipts"
          checked={readReceipts}
          onChange={(v) => {
            setReadReceipts(v);
            patch({ readReceipts: v });
          }}
        />
        <ToggleRow
          label="Typing indicator"
          checked={shareTyping}
          onChange={(v) => {
            setShareTyping(v);
            patch({ shareTyping: v });
          }}
        />
      </FormCard>

      <p className="text-[13px] font-semibold text-muted">
        Web push registration uses the same preference fields as mobile; enable push when browser support is added.
      </p>
    </div>
  );
}
