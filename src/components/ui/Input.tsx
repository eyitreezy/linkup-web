'use client';

import { cn } from '@/utils/cn';
import { type InputHTMLAttributes, forwardRef } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <label className="block w-full">
        {label ? (
          <span className="mb-1.5 block text-[13px] font-bold text-foreground">{label}</span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-2xl border border-border bg-[#F8F9FC] px-4 py-3.5 text-[15px] font-semibold text-foreground outline-none transition placeholder:font-medium placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20',
            error && 'border-[#EF4444] focus:ring-[#EF4444]/20',
            className
          )}
          {...props}
        />
        {error ? <span className="mt-1.5 block text-[12px] font-semibold text-[#EF4444]">{error}</span> : null}
      </label>
    );
  }
);
Input.displayName = 'Input';
