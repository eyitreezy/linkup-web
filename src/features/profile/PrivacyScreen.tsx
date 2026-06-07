'use client';

import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { FormCard } from '@/components/settings/FormCard';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { PremiumSectionHead } from '@/features/premium/PremiumSectionHead';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { IoHandLeftOutline, IoHelpCircleOutline, IoPersonRemoveOutline } from 'react-icons/io5';

type BlockRow = { blocked_id: string; created_at: string };

export function PrivacyScreen() {
  const user = useAuthStore((s) => s.user);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setBlocks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const client = createClient();
    const { data } = await client
      .from('user_blocks')
      .select('blocked_id, created_at')
      .eq('blocker_id', user.id);
    setBlocks((data as BlockRow[]) ?? []);
    setLoading(false);
  }, [user?.id]);

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

      <PremiumSectionHead title={`Blocked accounts (${blocks.length})`} />

      {loading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-[#EDE8FF]/70" />
      ) : blocks.length === 0 ? (
        <AppEmptyState
          icon={<IoHandLeftOutline size={32} className="text-primary" />}
          title="No blocks yet"
          description="People you block stay hidden from your feed, discovery, and messages — same privacy rules as mobile."
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
