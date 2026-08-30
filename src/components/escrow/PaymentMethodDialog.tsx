'use client';

import { EscrowModalShell } from '@/components/escrow/EscrowModalShell';
import { PaymentMethodSelector } from '@/components/escrow/PaymentMethodSelector';
import { cn } from '@/utils/cn';

type PaymentMethod = 'card' | 'bank_transfer';

type Props = {
  open: boolean;
  selected: PaymentMethod | null;
  onSelect: (method: PaymentMethod) => void;
  onContinue: () => void;
  onClose: () => void;
  busy?: boolean;
  description?: string;
};

export function PaymentMethodDialog({
  open,
  selected,
  onSelect,
  onContinue,
  onClose,
  busy = false,
  description = 'Choose card checkout or bank transfer for this escrow payment.',
}: Props) {
  return (
    <EscrowModalShell open={open} onClose={onClose} maxWidth="sm">
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">
            How would you like to pay?
          </h2>
          <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted">
            {description}
          </p>
        </div>
        <PaymentMethodSelector selected={selected} onSelect={onSelect} />
        <button
          type="button"
          onClick={onContinue}
          disabled={!selected || busy}
          className={cn(
            'w-full rounded-full py-4 text-[16px] font-extrabold text-white transition active:scale-[0.985]',
            !selected || busy
              ? 'cursor-not-allowed bg-border text-white/70'
              : 'linkup-gradient-primary hover:opacity-95'
          )}
        >
          {busy ? 'Please wait…' : 'Continue'}
        </button>
      </div>
    </EscrowModalShell>
  );
}
