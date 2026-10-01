'use client';

import { ConfirmDialog } from '@/features/plan-management/ConfirmDialog';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { saveMatchMakerPostMeetupReflection } from '@/services/matchmaker.service';
import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';

const FEELINGS = [
  { id: 'much_stronger', label: 'Much stronger' },
  { id: 'stronger', label: 'Stronger' },
  { id: 'same', label: 'Same' },
  { id: 'weaker', label: 'Weaker' },
  { id: 'not_sure', label: 'Not sure yet' },
] as const;

type Props = {
  connectionId: string;
  partnerName: string;
  onDismiss: () => void;
  onChooseEnd: () => void;
};

export function MatchMakerPostMeetupFlow({ connectionId, partnerName, onDismiss, onChooseEnd }: Props) {
  const [step, setStep] = useState<'feeling' | 'next'>('feeling');
  const [feeling, setFeeling] = useState<string | null>(null);
  const [quality, setQuality] = useState('');
  const [busy, setBusy] = useState(false);
  const [continueConfirm, setContinueConfirm] = useState(false);
  const [endConfirm, setEndConfirm] = useState(false);

  async function saveFeeling(skip: boolean) {
    setBusy(true);
    await saveMatchMakerPostMeetupReflection(createClient(), connectionId, {
      feeling: skip ? null : feeling,
      quality: skip ? null : quality.trim() || null,
      skipped: skip,
    });
    setBusy(false);
    setStep('next');
  }

  async function confirmContinue() {
    setBusy(true);
    await saveMatchMakerPostMeetupReflection(createClient(), connectionId, {
      path: 'continue',
    });
    setBusy(false);
    setContinueConfirm(false);
    onDismiss();
  }

  function confirmEndPath() {
    setEndConfirm(false);
    onChooseEnd();
    onDismiss();
  }

  if (step === 'feeling') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
        role="dialog"
      >
        <button type="button" className="absolute inset-0" aria-label="Dismiss" onClick={onDismiss} />
        <div
          className="relative w-full max-w-lg rounded-t-3xl border p-5 shadow-xl sm:rounded-3xl"
          style={{ borderColor: MATCHMAKER_THEME.border, background: MATCHMAKER_THEME.surfaceWarm }}
        >
          <p className="font-display text-xl font-extrabold">How did you feel after meeting {partnerName}?</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {FEELINGS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFeeling(f.id)}
                className="rounded-full border px-3 py-2 text-[12px] font-extrabold"
                style={{
                  borderColor: feeling === f.id ? MATCHMAKER_THEME.accent : MATCHMAKER_THEME.border,
                  color: feeling === f.id ? MATCHMAKER_THEME.accent : MATCHMAKER_THEME.textPrimary,
                  background: MATCHMAKER_THEME.surface,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="mt-6 text-[14px] font-extrabold">What quality mattered most to you?</p>
          <input
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            placeholder="Type something..."
            className="mt-2 w-full rounded-2xl border px-4 py-3 text-[14px] font-semibold"
            style={{ borderColor: MATCHMAKER_THEME.border, background: MATCHMAKER_THEME.surface }}
          />
          <button
            type="button"
            disabled={busy || (!feeling && !quality.trim())}
            onClick={() => void saveFeeling(false)}
            className="mt-6 w-full min-h-[44px] rounded-full text-[14px] font-extrabold text-white disabled:opacity-50"
            style={{ background: MATCHMAKER_THEME.primary }}
          >
            Save (private)
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveFeeling(true)}
            className="mt-3 w-full text-center text-[13px] font-semibold underline"
            style={{ color: MATCHMAKER_THEME.textMuted }}
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#FDF8F4] p-4"
        role="dialog"
      >
        <div className="w-full max-w-md text-center">
          <p className="font-display text-2xl font-extrabold">What comes next for you and {partnerName}?</p>
          <button
            type="button"
            onClick={() => setContinueConfirm(true)}
            className="mt-8 w-full rounded-2xl border-2 px-4 py-5 text-left"
            style={{ borderColor: MATCHMAKER_THEME.accent, background: MATCHMAKER_THEME.surface }}
          >
            <p className="text-[16px] font-extrabold">Continue this connection</p>
            <p className="mt-2 text-[13px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
              Keep building what you have started. You can create more plans without the 21-day wait.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setEndConfirm(true)}
            className="mt-4 w-full rounded-2xl border px-4 py-5 text-left"
            style={{ borderColor: MATCHMAKER_THEME.border, background: MATCHMAKER_THEME.surface }}
          >
            <p className="text-[16px] font-extrabold">End this connection</p>
            <p className="mt-2 text-[13px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
              Close this chapter. A reflection period follows.
            </p>
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="mt-6 text-[13px] font-semibold underline"
            style={{ color: MATCHMAKER_THEME.textMuted }}
          >
            Dismiss
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={continueConfirm}
        title="Continue this connection?"
        message="You can create more plans together without waiting another 21 days."
        confirmLabel={busy ? 'Saving…' : 'Continue'}
        cancelLabel="Go back"
        onConfirm={() => void confirmContinue()}
        onClose={() => setContinueConfirm(false)}
        busy={busy}
      />
      <ConfirmDialog
        open={endConfirm}
        title="End this connection?"
        message="You will choose a private reason on the next screen."
        confirmLabel="Continue"
        cancelLabel="Go back"
        onConfirm={confirmEndPath}
        onClose={() => setEndConfirm(false)}
      />
    </>
  );
}
