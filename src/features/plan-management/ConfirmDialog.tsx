'use client';

import { cn } from '@/utils/cn';

type Props = {
  open: boolean;
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  confirmVariant?: 'neutral' | 'danger';
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  title,
  message,
  cancelLabel,
  confirmLabel,
  confirmVariant = 'neutral',
  busy,
  onClose,
  onConfirm,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm min-[425px]:items-center min-[425px]:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="linkup-card w-full min-w-0 max-w-md rounded-2xl p-4 shadow-xl min-[425px]:p-6">
        <h2 id="confirm-title" className="font-display text-lg font-extrabold text-foreground">
          {title}
        </h2>
        <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted">
          {message}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 min-[425px]:mt-6 min-[425px]:flex-row min-[425px]:flex-wrap min-[425px]:justify-end min-[425px]:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-[44px] w-full rounded-full border border-border px-4 text-[14px] font-extrabold text-muted transition hover:bg-[#EDE8FF]/50 min-[425px]:w-auto min-[425px]:px-5"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirm()}
            className={cn(
              'min-h-[44px] w-full rounded-full px-4 text-[14px] font-extrabold text-white transition min-[425px]:w-auto min-[425px]:px-5',
              confirmVariant === 'danger' ? 'bg-[#EF4444] hover:opacity-95' : 'linkup-gradient-primary hover:opacity-95'
            )}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
