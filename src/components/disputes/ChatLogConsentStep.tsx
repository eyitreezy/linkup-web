'use client';

import { submitChatLogConsent } from '@/lib/groupPlan/liveLocation';
import { cn } from '@/utils/cn';
import { useState } from 'react';

type Props = {
  disputeId: string;
  onConsentSubmitted: () => void;
};

export function ChatLogConsentStep({ disputeId, onConsentSubmitted }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConsent(consented: boolean) {
    setBusy(true);
    setError(null);
    const result = await submitChatLogConsent(disputeId, consented);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onConsentSubmitted();
  }

  return (
    <div className="linkup-card space-y-4 p-5">
      <h3 className="font-display text-lg font-extrabold text-foreground">Chat log access</h3>
      <p className="text-[14px] font-semibold leading-relaxed text-muted">
        To assist in resolving this dispute, the LinkUp dispute team may review your in-app conversation
        with the other party. Do you consent?
      </p>
      <p className="text-[14px] font-semibold leading-relaxed text-muted">
        If both parties consent, the full conversation is made available. If only one party consents,
        access is limited to messages up to the point of non-consent. If neither consents, the dispute is
        resolved on video and written statement evidence only.
      </p>
      <p className="text-[14px] font-semibold leading-relaxed text-muted">
        Chat logs are never accessed without a live dispute and your consent.
      </p>
      {error ? <p className="text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => void handleConsent(true)}
          disabled={busy}
          className={cn(
            'flex min-h-[44px] flex-1 items-center justify-center rounded-full linkup-gradient-primary px-4 text-[14px] font-extrabold text-white disabled:opacity-50'
          )}
        >
          Yes, the team may review our chat
        </button>
        <button
          type="button"
          onClick={() => void handleConsent(false)}
          disabled={busy}
          className="flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-border px-4 text-[14px] font-extrabold text-muted disabled:opacity-50"
        >
          No, do not share our chat
        </button>
      </div>
    </div>
  );
}
