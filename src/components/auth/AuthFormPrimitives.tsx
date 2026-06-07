'use client';

import { cn } from '@/utils/cn';
import { type InputHTMLAttributes, forwardRef } from 'react';

/** Auth input — light card on desktop, glass on mobile (inside .auth-mobile-root). */
export const AuthInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }
>(({ className, label, error, id, ...props }, ref) => {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <label className="block w-full">
      {label ? (
        <span className="auth-field-label mb-1.5 block text-[13px] font-bold text-foreground max-lg:sr-only">
          {label}
        </span>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'auth-input w-full rounded-2xl border border-border bg-[#F8F9FC] px-4 py-3.5 text-[15px] font-semibold text-foreground outline-none transition placeholder:font-medium placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 max-lg:rounded-2xl max-lg:border-white/14 max-lg:bg-white/[0.08] max-lg:text-white max-lg:placeholder:text-white/42 max-lg:focus:border-primary/55 max-lg:focus:ring-primary/20',
          error && 'border-[#EF4444] focus:ring-[#EF4444]/20',
          className
        )}
        {...props}
      />
      {error ? (
        <span className="auth-error mt-1.5 block text-[12px] font-semibold text-[#EF4444] max-lg:text-center">
          {error}
        </span>
      ) : null}
    </label>
  );
});
AuthInput.displayName = 'AuthInput';

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  fullWidth?: boolean;
  variant?: 'gradient' | 'ghost' | 'primary';
};

export function AuthButton({ className, fullWidth, variant = 'gradient', children, type, ...props }: BtnProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cn(
        'inline-flex min-h-[48px] items-center justify-center rounded-full px-6 text-[15px] font-extrabold transition active:scale-[0.99] disabled:opacity-50 max-lg:min-h-0 max-lg:px-5',
        variant === 'gradient' &&
          'auth-btn-gradient linkup-gradient-primary text-white shadow-md hover:opacity-95 max-lg:shadow-[0_8px_20px_rgba(108,99,255,0.35)]',
        variant === 'ghost' && 'auth-btn-ghost max-lg:border max-lg:border-white/35 max-lg:bg-transparent max-lg:text-white/90',
        variant === 'primary' && 'bg-primary text-white hover:opacity-95',
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function AuthTrustLine() {
  return (
    <p className="auth-trust max-lg:block hidden">
      Your data stays private. We never sell your information.
    </p>
  );
}
