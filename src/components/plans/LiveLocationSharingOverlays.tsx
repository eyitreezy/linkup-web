'use client';

import { LiveLocationConsentModal } from '@/components/plans/LiveLocationConsentModal';

type Props = {
  showConsent: boolean;
  showPicker: boolean;
  onConsented: () => void;
  onDeclined: () => void;
  onPickDuration: (minutes: number) => void;
  onClosePicker: () => void;
};

export function LiveLocationSharingOverlays({
  showConsent,
  showPicker,
  onConsented,
  onDeclined,
  onPickDuration,
  onClosePicker,
}: Props) {
  if (showConsent) {
    return <LiveLocationConsentModal onConsented={onConsented} onDeclined={onDeclined} />;
  }

  if (!showPicker) return null;

  return (
    <div className="border-b border-border/60 bg-white px-2 py-2 min-[360px]:px-3">
      <p className="px-1 pb-1 text-[10px] font-extrabold uppercase tracking-wide text-muted">
        Share for how long?
      </p>
      <div className="space-y-1">
        {[
          { label: '15 minutes', value: 15 },
          { label: '1 hour', value: 60 },
          { label: 'Until I stop', value: -1 },
        ].map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onPickDuration(opt.value)}
            className="flex w-full rounded-lg px-3 py-2 text-left text-[14px] font-extrabold text-foreground hover:bg-[#F5F6FA]"
          >
            {opt.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onClosePicker}
          className="w-full rounded-lg px-3 py-2 text-[13px] font-semibold text-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
