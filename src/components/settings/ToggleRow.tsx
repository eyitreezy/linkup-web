'use client';

import { cn } from '@/utils/cn';

type Props = {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
};

export function ToggleSwitch({
  checked,
  onChange,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'group relative h-7 w-12 shrink-0 rounded-full',
        'transition-[background-color,box-shadow] duration-300 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
        checked ? 'linkup-gradient-primary shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]' : 'bg-[#E8E4F5]',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white',
          'shadow-[0_1px_3px_rgba(26,29,38,0.14)]',
          'transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]',
          'group-active:scale-[0.94]',
          checked
            ? 'translate-x-5 shadow-[0_2px_8px_rgba(108,99,255,0.28)]'
            : 'translate-x-0 group-hover:shadow-[0_2px_6px_rgba(26,29,38,0.12)]'
        )}
      />
    </button>
  );
}

export function ToggleRow({ label, hint, checked, onChange, disabled }: Props) {
  const switchId = label.replace(/\s+/g, '-').toLowerCase();

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/50 py-3.5 last:border-b-0">
      <label htmlFor={switchId} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-[15px] font-extrabold text-foreground">{label}</span>
        {hint ? <span className="mt-0.5 block text-[13px] font-semibold leading-snug text-muted">{hint}</span> : null}
      </label>
      <ToggleSwitch id={switchId} checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}
