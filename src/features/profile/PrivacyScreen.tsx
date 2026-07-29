'use client';

import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { FormCard } from '@/components/settings/FormCard';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { ToggleRow } from '@/components/settings/ToggleRow';
import { useGatedAction } from '@/contexts/UpgradeGateContext';
import { PremiumSectionHead } from '@/features/premium/PremiumSectionHead';
import { useSubscriptionContext } from '@/lib/subscription/SubscriptionContext';
import { createClient } from '@/lib/supabase/client';
import { fetchUserProfileBundle } from '@/services/profile.service';
import type { ProfilePreferences } from '@/types/database';
import { useAuthStore } from '@/stores/auth-store';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { IoHandLeftOutline, IoHelpCircleOutline, IoPersonRemoveOutline } from 'react-icons/io5';

type BlockRow = { blocked_id: string; created_at: string };

export function PrivacyScreen() {
  const user = useAuthStore((s) => s.user);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [incognito, setIncognito] = useState(false);
  const [hideProfileViews, setHideProfileViews] = useState(false);
  const [maskedActivity, setMaskedActivity] = useState(false);
  const runGated = useGatedAction();
  const { subscriptionState } = useSubscriptionContext();

  const load = useCallback(async () => {
    if (!user?.id) {
      setBlocks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const client = createClient();
    const [{ data }, bundle] = await Promise.all([
      client.from('user_blocks').select('blocked_id, created_at').eq('blocker_id', user.id),
      fetchUserProfileBundle(client, user.id),
    ]);
    setBlocks((data as BlockRow[]) ?? []);
    const profile = bundle?.profile;
    const prefs = profile?.preferences;
    setIncognito(!!(profile?.incognito_browse_enabled ?? prefs?.incognito_browse));
    setHideProfileViews(!!(profile?.profile_view_privacy_enabled ?? prefs?.hide_profile_views));
    setMaskedActivity(!!profile?.masked_activity_enabled);
    setLoading(false);
  }, [user?.id]);

  const savePrivacyPref = useCallback(
    async (
      patch: Partial<Pick<ProfilePreferences, 'incognito_browse' | 'hide_profile_views'>> & {
        incognito_browse_enabled?: boolean;
        profile_view_privacy_enabled?: boolean;
        masked_activity_enabled?: boolean;
      }
    ) => {
      if (!user?.id) return;
      const client = createClient();
      const bundle = await fetchUserProfileBundle(client, user.id);
      const base = bundle?.profile?.preferences ?? {};
      const columnPatch: Record<string, boolean> = {};
      if (patch.incognito_browse !== undefined) {
        columnPatch.incognito_browse_enabled = patch.incognito_browse;
      }
      if (patch.hide_profile_views !== undefined) {
        columnPatch.profile_view_privacy_enabled = patch.hide_profile_views;
      }
      if (patch.masked_activity_enabled !== undefined) {
        columnPatch.masked_activity_enabled = patch.masked_activity_enabled;
      }
      const prefPatch: Partial<ProfilePreferences> = {};
      if (patch.incognito_browse !== undefined) prefPatch.incognito_browse = patch.incognito_browse;
      if (patch.hide_profile_views !== undefined) prefPatch.hide_profile_views = patch.hide_profile_views;
      await client
        .from('profiles')
        .update({
          ...columnPatch,
          preferences: { ...base, ...prefPatch },
        })
        .eq('user_id', user.id);
    },
    [user?.id]
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) {
    return (
      <p className="text-[14px] font-semibold text-muted">
        <Link href="/login" className="font-extrabold text-primary">
          Sign in
        </Link>{' '}
        to manage privacy settings.
      </p>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader
        kicker="Trust"
        title="Privacy & safety"
        subtitle="Blocked people won't appear in your plans feed. Reports and serious issues: reach Help & Support."
      />

      <Link
        href="/support"
        className="flex min-h-[48px] items-center justify-center gap-2 rounded-full linkup-gradient-primary text-[15px] font-extrabold text-white shadow-md"
      >
        <IoHelpCircleOutline size={22} />
        Help & support
      </Link>

      <PremiumSectionHead title="Platinum privacy" />
      <FormCard>
        <ToggleRow
          label="Incognito browsing"
          hint="Browse Discover without showing activity to others."
          checked={incognito}
          onChange={(v) => {
            if (!v) {
              setIncognito(false);
              void savePrivacyPref({ incognito_browse: false });
              return;
            }
            void runGated('privacy.incognito_browse', () => {
              setIncognito(true);
              void savePrivacyPref({ incognito_browse: true });
            });
          }}
        />
        <ToggleRow
          label="Profile view privacy"
          hint="Hide when you view other members' profiles."
          checked={hideProfileViews}
          onChange={(v) => {
            if (!v) {
              setHideProfileViews(false);
              void savePrivacyPref({ hide_profile_views: false });
              return;
            }
            void runGated('privacy.profile_view', () => {
              setHideProfileViews(true);
              void savePrivacyPref({ hide_profile_views: true });
            });
          }}
        />
        {subscriptionState.effectiveTier === 'PLATINUM' ? (
          <ToggleRow
            label="Masked activity"
            hint="Your recent activity won't appear in feeds or suggestion lists."
            checked={maskedActivity}
            onChange={(v) => {
              setMaskedActivity(v);
              void savePrivacyPref({ masked_activity_enabled: v });
            }}
          />
        ) : null}
      </FormCard>

      <PremiumSectionHead title={`Blocked accounts (${blocks.length})`} />

      {loading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-[#EDE8FF]/70" />
      ) : blocks.length === 0 ? (
        <AppEmptyState
          icon={<IoHandLeftOutline size={32} className="text-primary" />}
          title="No blocks yet"
          description="People you block stay hidden from your feed, discovery, and messages, with the same privacy rules as mobile."
          secondaryAction={{ label: 'Help & support', href: '/support', variant: 'secondary' }}
        />
      ) : (
        <ul className="space-y-2">
          {blocks.map((item) => (
            <li key={item.blocked_id} className="linkup-card flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-primary/20 bg-background">
                <IoPersonRemoveOutline size={18} className="text-primary" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-foreground">{item.blocked_id.slice(0, 8)}…</p>
                <p className="text-[12px] font-semibold text-muted">Blocked account</p>
              </div>
              <p className="text-[12px] font-semibold text-muted">
                {new Date(item.created_at).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
