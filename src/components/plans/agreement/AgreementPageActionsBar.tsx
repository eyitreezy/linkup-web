'use client';

import { cn } from '@/utils/cn';
import { IoChatbubbleEllipsesOutline } from 'react-icons/io5';

const ACTIONS_BAR_CLEARANCE = 'pb-[9.5rem]';

type Props = {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  busy?: boolean;
  onMessage: () => void;
  messageLabel?: string;
  className?: string;
};

/** Fixed primary + message actions for the Confirm plan screen (no policy checkbox). */
export function AgreementPageActionsBar({
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  busy = false,
  onMessage,
  messageLabel = 'Message',
  className,
}: Props) {
  return (
    <div
      className={cn('fixed bottom-0 left-0 right-0 z-20 border-t border-border/60 bg-white', className)}
      role="region"
      aria-label="Plan actions"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4 sm:flex-row sm:px-6">
        <button
          type="button"
          disabled={primaryDisabled || busy}
          onClick={onPrimary}
          className="flex min-h-[48px] flex-1 items-center justify-center rounded-full linkup-gradient-primary px-6 text-[14px] font-extrabold text-white disabled:opacity-50"
        >
          {primaryLabel}
        </button>
        <button
          type="button"
          onClick={onMessage}
          aria-label={`Message ${messageLabel.replace(/^Message\s+/, '')}`}
          className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full border border-primary/25 px-6 text-[14px] font-extrabold text-primary sm:flex-initial"
        >
          <IoChatbubbleEllipsesOutline size={18} />
          {messageLabel}
        </button>
      </div>
      <div className="h-6 bg-gradient-to-b from-white to-secondary/10" aria-hidden />
    </div>
  );
}

export { ACTIONS_BAR_CLEARANCE };
