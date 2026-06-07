'use client';

import { cn } from '@/utils/cn';
import { IoClose, IoDocumentTextOutline, IoPersonRemoveOutline } from 'react-icons/io5';

type Props = {
  open: boolean;
  onClose: () => void;
  onReportUser: () => void;
  onPlanDispute: () => void;
  canPlanDispute: boolean;
};

export function ChatSafetySheet({ open, onClose, onReportUser, onPlanDispute, canPlanDispute }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-t-3xl border border-border bg-white p-5 shadow-xl sm:rounded-3xl"
        role="dialog"
        aria-labelledby="chat-safety-title"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" aria-hidden />
        <div className="mb-3 flex items-center justify-between">
          <h2 id="chat-safety-title" className="font-display text-xl font-extrabold text-foreground">
            Safety
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted hover:bg-[#F5F6FA]"
            aria-label="Close"
          >
            <IoClose size={22} />
          </button>
        </div>
        <p className="mb-4 text-[14px] font-semibold leading-relaxed text-muted">
          Choose the option that fits. Plan issues (payment, no-show, scams) can be filed from your disputes hub.
        </p>
        <button
          type="button"
          onClick={() => {
            onClose();
            onReportUser();
          }}
          className="flex w-full items-center gap-3 rounded-2xl border border-border px-4 py-3.5 text-left transition hover:border-primary/30 hover:bg-[#EDE8FF]/40"
        >
          <IoPersonRemoveOutline className="shrink-0 text-primary" size={22} />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold text-foreground">Report this person</span>
            <span className="block text-[13px] font-semibold text-muted">
              Harassment, fake profile, or other behavior.
            </span>
          </span>
        </button>
        <button
          type="button"
          disabled={!canPlanDispute}
          onClick={() => {
            if (!canPlanDispute) return;
            onClose();
            onPlanDispute();
          }}
          className={cn(
            'mt-2 flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition',
            canPlanDispute
              ? 'border-border hover:border-primary/30 hover:bg-[#EDE8FF]/40'
              : 'cursor-not-allowed border-border/60 opacity-60'
          )}
        >
          <IoDocumentTextOutline className="shrink-0 text-primary" size={22} />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold text-foreground">
              Report an issue with the plan
            </span>
            <span className="block text-[13px] font-semibold text-muted">
              {canPlanDispute
                ? 'Payment problems, no-show, misconduct, or scams.'
                : 'Available when you have an active or completed shared plan with this chat.'}
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
