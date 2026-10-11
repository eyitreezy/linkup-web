'use client';

import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import { MatchMakerLayout } from '@/features/matchmaker/MatchMakerLayout';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { respondMatchMakerReaffirmation } from '@/services/matchmaker.service';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
  onComplete: () => void;
};

export function MatchMakerReaffirmationOverlay({ onComplete }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<'yes' | 'snooze' | 'leave' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leftPool, setLeftPool] = useState(false);

  async function act(action: 'yes' | 'snooze' | 'leave') {
    setBusy(action);
    setError(null);
    const { error: rpcError } = await respondMatchMakerReaffirmation(createClient(), action);
    setBusy(null);
    if (rpcError) {
      setError(rpcError);
      return;
    }
    if (action === 'leave') {
      setLeftPool(true);
      return;
    }
    onComplete();
  }

  if (leftPool) {
    return (
      <MatchMakerLayout>
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center"
          style={{ background: MATCHMAKER_THEME.background }}
        >
          <MatchMakerTabIcon size={48} className="text-[#9B1B4B]/80" />
          <h1 className="mt-6 font-display text-[22px] font-extrabold" style={{ color: MATCHMAKER_THEME.textPrimary }}>
            You are off the pool for now
          </h1>
          <p className="mt-3 max-w-md text-[14px] font-semibold leading-relaxed" style={{ color: MATCHMAKER_THEME.textMuted }}>
            Your MatchMaker preferences are saved. You can turn pool visibility back on anytime in MatchMaker settings.
          </p>
          <button
            type="button"
            onClick={() => router.push('/matchmaker/settings')}
            className="mt-8 min-h-[48px] rounded-full linkup-gradient-primary px-8 text-[15px] font-extrabold text-white"
          >
            MatchMaker settings
          </button>
        </div>
      </MatchMakerLayout>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center"
      style={{ background: MATCHMAKER_THEME.background }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mm-reaffirm-title"
    >
      <MatchMakerTabIcon size={48} className="text-[#9B1B4B]/80" />
      <h1 id="mm-reaffirm-title" className="mt-6 font-display text-[22px] font-extrabold" style={{ color: MATCHMAKER_THEME.textPrimary }}>
        Still looking?
      </h1>
      <p className="mt-3 max-w-md text-[14px] font-semibold leading-relaxed" style={{ color: MATCHMAKER_THEME.textMuted }}>
        You have been in the MatchMaker pool for 60 days. We want to make sure you are still actively looking for a
        long-term relationship before keeping your profile visible to others.
      </p>

      {error ? <p className="mt-4 text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}

      <button
        type="button"
        disabled={!!busy}
        onClick={() => void act('yes')}
        className="mt-8 w-full max-w-sm min-h-[48px] rounded-full linkup-gradient-primary text-[15px] font-extrabold text-white disabled:opacity-60"
      >
        {busy === 'yes' ? 'Saving…' : 'Yes, I am still looking'}
      </button>

      <button
        type="button"
        disabled={!!busy}
        onClick={() => void act('snooze')}
        className="mt-4 text-[14px] font-extrabold underline disabled:opacity-60"
        style={{ color: MATCHMAKER_THEME.accent }}
      >
        {busy === 'snooze' ? 'Snoozing…' : 'Ask me later'}
      </button>

      <button
        type="button"
        disabled={!!busy}
        onClick={() => void act('leave')}
        className="mt-6 text-[12px] font-semibold underline disabled:opacity-60"
        style={{ color: MATCHMAKER_THEME.textMuted }}
      >
        {busy === 'leave' ? 'Updating…' : 'Remove me from the pool'}
      </button>
    </div>
  );
}
