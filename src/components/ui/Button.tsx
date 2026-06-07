'use client';

import { cn } from '@/utils/cn';
import { type ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  fullWidth?: boolean;
};

const variants: Record<Variant, string> = {
  primary:
    'bg-primary text-white shadow-md hover:opacity-95 active:scale-[0.99] disabled:opacity-45',
  secondary:
    'bg-white text-foreground border border-border hover:bg-[#F8F7FF] disabled:opacity-45',
  ghost: 'bg-transparent text-muted hover:text-foreground hover:bg-black/5',
  danger: 'bg-[#EF4444] text-white hover:opacity-95',
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = 'primary', fullWidth, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex min-h-[48px] items-center justify-center rounded-full px-6 text-[15px] font-extrabold transition',
        variants[variant],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);
Button.displayName = 'Button';
