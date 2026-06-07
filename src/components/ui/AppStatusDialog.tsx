'use client';

import { cn } from '@/utils/cn';
import { IoCheckmarkCircle, IoCloseCircle } from 'react-icons/io5';

type Props = {
  open: boolean;
  title: string;
  message: string;
  variant?: 'success' | 'error';
  buttonLabel?: string;
  onClose: () => void;
};

export function AppStatusDialog({
  open,
  title,
  message,
  variant = 'success',
  buttonLabel = 'Got it',
  onClose,
}: Props) {
  if (!open) return null;

  const isSuccess = variant === 'success';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm min-[425px]:items-center min-[425px]:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-dialog-title"
      onClick={onClose}
    >
      <div
        className="linkup-card w-full min-w-0 max-w-md rounded-2xl p-4 shadow-xl min-[425px]:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              isSuccess ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
            )}
            aria-hidden
          >
            {isSuccess ? <IoCheckmarkCircle size={24} /> : <IoCloseCircle size={24} />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="status-dialog-title" className="font-display text-lg font-extrabold text-foreground">
              {title}
            </h2>
            <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted">{message}</p>
          </div>
        </div>
        <div className="mt-5 min-[425px]:mt-6">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'min-h-[44px] w-full rounded-full px-4 text-[14px] font-extrabold text-white transition hover:opacity-95',
              isSuccess ? 'linkup-gradient-primary' : 'bg-[#EF4444]'
            )}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
