'use client';

import { EscrowModalShell } from '@/components/escrow/EscrowModalShell';
import { cn } from '@/utils/cn';
import { IoShieldCheckmarkOutline, IoWarningOutline } from 'react-icons/io5';

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmVariant?: 'primary' | 'danger';
  busy?: boolean;
};

export function EscrowConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmVariant = 'primary',
  busy = false,
}: Props) {
  const Icon = confirmVariant === 'danger' ? IoWarningOutline : IoShieldCheckmarkOutline;

  return (
    <EscrowModalShell open={open} onClose={onCancel} maxWidth="md" showClose={false}>
      <div className="flex flex-col items-center text-center">
        <div
          className={cn(
            'mb-4 flex h-12 w-12 items-center justify-center rounded-full',
            confirmVariant === 'danger' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'
          )}
        >
          <Icon size={24} />
        </div>
        <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">{title}</h2>
        <p className="mt-2 text-[15px] font-semibold leading-relaxed text-muted">{message}</p>
        <div className="mt-6 grid w-full grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-[48px] rounded-full border border-[#D8DCE6] bg-white text-[15px] font-extrabold text-foreground transition hover:bg-muted/5 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              'min-h-[48px] rounded-full text-[15px] font-extrabold text-white disabled:opacity-50',
              confirmVariant === 'danger' ? 'bg-gradient-to-r from-secondary to-[#FF8A9B]' : 'linkup-gradient-primary'
            )}
          >
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </EscrowModalShell>
  );
}
