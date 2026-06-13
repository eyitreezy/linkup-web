'use client';

import type { ReactNode } from 'react';
import { IoClose } from 'react-icons/io5';

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
  showClose?: boolean;
};

const MAX_W = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
} as const;

export function EscrowModalShell({
  open,
  onClose,
  children,
  maxWidth = 'lg',
  showClose = true,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm min-[425px]:items-center min-[425px]:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`relative linkup-card max-h-[90vh] w-full ${MAX_W[maxWidth]} overflow-hidden rounded-2xl shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/10 via-secondary/5 to-transparent"
          aria-hidden
        />
        {showClose ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-white/90 text-muted transition hover:bg-[#EDE8FF]/80 hover:text-primary"
            aria-label="Close"
          >
            <IoClose size={18} />
          </button>
        ) : null}
        <div className="relative max-h-[90vh] overflow-y-auto p-5 min-[425px]:p-6">{children}</div>
      </div>
    </div>
  );
}
