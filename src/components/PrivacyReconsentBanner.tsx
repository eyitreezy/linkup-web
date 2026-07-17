'use client';

import { IoClose, IoDocumentTextOutline } from 'react-icons/io5';

type Props = {
  onReview: () => void;
  onDismiss: () => void;
};

/** Matches TrialBanner layout — full-width bar above main content. */
export function PrivacyReconsentBanner({ onReview, onDismiss }: Props) {
  return (
    <div className="border-b border-primary/15 bg-[#EDE8FF]/90">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 min-[400px]:px-6">
        <button
          type="button"
          onClick={onReview}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-[12px] font-semibold text-foreground min-[400px]:text-[13px]"
        >
          <IoDocumentTextOutline className="shrink-0 text-primary" size={14} />
          <span className="truncate">We&apos;ve updated our Privacy Policy</span>
          <span className="shrink-0 font-extrabold text-primary">Review & accept →</span>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-full p-1 text-muted transition hover:bg-black/5"
          aria-label="Dismiss privacy policy banner"
        >
          <IoClose size={16} />
        </button>
      </div>
    </div>
  );
}
