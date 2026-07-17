'use client';

import { cn } from '@/utils/cn';
import { IoCardOutline, IoCheckmark, IoSwapHorizontalOutline } from 'react-icons/io5';

type PaymentMethod = 'card' | 'bank_transfer';

type Props = {
  selected: PaymentMethod | null;
  onSelect: (method: PaymentMethod) => void;
};

const OPTIONS: {
  method: PaymentMethod;
  icon: typeof IoCardOutline;
  title: string;
  subtitle: string;
}[] = [
  {
    method: 'card',
    icon: IoCardOutline,
    title: 'Pay by card',
    subtitle: 'Instant confirmation. Refunds in 5-10 business days.',
  },
  {
    method: 'bank_transfer',
    icon: IoSwapHorizontalOutline,
    title: 'Pay by bank transfer',
    subtitle: 'Transfer to a dedicated account. Refunds in 3 business days.',
  },
];

export function PaymentMethodSelector({ selected, onSelect }: Props) {
  return (
    <div className="space-y-3" role="radiogroup" aria-label="Payment method">
      {OPTIONS.map((option) => {
        const isSelected = selected === option.method;
        const Icon = option.icon;
        return (
          <button
            key={option.method}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(option.method)}
            className={cn(
              'relative w-full rounded-2xl border-2 p-4 text-left transition active:scale-[0.995]',
              isSelected
                ? 'border-primary bg-[#EDE8FF]/70 shadow-md ring-2 ring-primary/25'
                : 'border-border bg-white hover:border-primary/30 hover:bg-[#F8F7FF]/80'
            )}
          >
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                  isSelected ? 'bg-primary/15 text-primary' : 'bg-[#F8F7FF] text-muted'
                )}
              >
                <Icon size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn('text-[15px] font-extrabold', isSelected ? 'text-primary' : 'text-foreground')}>
                  {option.title}
                </p>
                <p className="mt-1 text-[13px] font-semibold leading-snug text-muted">{option.subtitle}</p>
              </div>
              <span
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                  isSelected ? 'border-primary bg-primary' : 'border-border bg-white'
                )}
                aria-hidden
              >
                {isSelected ? <IoCheckmark size={12} className="text-white" /> : null}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
