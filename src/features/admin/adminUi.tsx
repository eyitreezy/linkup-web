'use client';

import { cn } from '@/utils/cn';
import { useState, type ReactNode } from 'react';
import { IoClose } from 'react-icons/io5';

export { shortUuid } from '@/lib/admin/adminLabels';

export function AdminSectionHeader({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-3 flex min-w-0 gap-1.5 min-[360px]:mb-4 min-[360px]:gap-2 min-[400px]:gap-3">
      {icon ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-gradient-to-br from-[#EDE8FF] to-white text-primary shadow-sm min-[360px]:h-10 min-[360px]:w-10 min-[360px]:rounded-2xl min-[400px]:h-11 min-[400px]:w-11">
          {icon}
        </div>
      ) : null}
      <div className="min-w-0">
        <h2 className="font-display text-base font-extrabold leading-snug tracking-tight text-foreground min-[360px]:text-lg min-[400px]:text-xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-[12px] font-semibold leading-snug text-muted min-[360px]:mt-1 min-[360px]:text-[13px]">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

export function AdminEmptyState({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-primary/20 bg-white/80 px-4 py-10 text-center min-[400px]:rounded-3xl min-[400px]:px-6 min-[400px]:py-12">
      {icon ? <div className="mb-3 text-primary opacity-80">{icon}</div> : null}
      <p className="font-display text-lg font-extrabold text-foreground">{title}</p>
      {subtitle ? <p className="mt-2 max-w-sm text-[14px] font-semibold text-muted">{subtitle}</p> : null}
    </div>
  );
}

export function AdminListCard({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const inner = (
    <div
      className={cn(
        'group relative min-w-0 overflow-hidden rounded-[16px] border border-primary/10 bg-white p-2.5 shadow-[0_8px_24px_rgba(108,99,255,0.08)] transition min-[360px]:rounded-[18px] min-[360px]:p-3 min-[400px]:rounded-[22px] min-[400px]:p-4',
        onClick && 'cursor-pointer hover:border-primary/25 hover:shadow-[0_12px_28px_rgba(108,99,255,0.12)]',
        className
      )}
    >
      <div
        className="pointer-events-none absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-secondary via-primary to-emerald-400"
        aria-hidden
      />
      <div className="pl-2">{children}</div>
    </div>
  );
  if (onClick) {
    return (
      <button type="button" className="w-full text-left" onClick={onClick}>
        {inner}
      </button>
    );
  }
  return inner;
}

export function StatusPill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'warn' | 'ok' | 'danger' | 'primary';
}) {
  const cls =
    tone === 'ok'
      ? 'bg-emerald-500/12 text-emerald-800 border-emerald-500/25'
      : tone === 'warn'
        ? 'bg-amber-500/15 text-amber-900 border-amber-500/30'
        : tone === 'danger'
          ? 'bg-red-500/12 text-red-700 border-red-500/25'
          : tone === 'primary'
            ? 'bg-primary/10 text-primary border-primary/25'
            : 'bg-slate-100 text-muted border-border';
  return (
    <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold capitalize', cls)}>
      {label.replace(/_/g, ' ')}
    </span>
  );
}

export function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full px-2 py-1 text-[10px] font-extrabold transition min-[360px]:px-2.5 min-[360px]:py-1.5 min-[360px]:text-[11px] min-[400px]:px-3.5 min-[400px]:text-[12px]',
        active ? 'linkup-gradient-primary text-white shadow-sm' : 'border border-border bg-white text-muted hover:border-primary/30'
      )}
    >
      {label}
    </button>
  );
}

export function AdminMetaRow({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[12px] font-semibold text-muted">
      {icon}
      {children}
    </div>
  );
}

export function AdminMonoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/80 bg-[#F8F9FC] px-3 py-2">
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 break-all font-mono text-[11px] font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function CopyIdsButton({ text, label = 'Copy ids' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          /* ignore */
        }
      }}
      className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-[#EDE8FF]/50 px-3 py-1.5 text-[12px] font-extrabold text-primary transition hover:bg-[#EDE8FF]"
    >
      {done ? 'Copied' : label}
    </button>
  );
}

export function AdminModal({
  open,
  onClose,
  title,
  kicker,
  accent = 'primary',
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  kicker?: string;
  accent?: 'primary' | 'danger' | 'secondary';
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  const accentCls =
    accent === 'danger'
      ? 'from-red-500 to-secondary'
      : accent === 'secondary'
        ? 'from-secondary to-primary'
        : 'from-primary to-secondary';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-1.5 backdrop-blur-sm min-[360px]:p-2 min-[400px]:items-center min-[400px]:p-4">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div
        className="relative flex max-h-[min(92vh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl min-[400px]:rounded-3xl"
        role="dialog"
        aria-labelledby="admin-modal-title"
      >
        <div className={cn('h-1.5 w-full bg-gradient-to-r', accentCls)} aria-hidden />
        <div className="flex items-start justify-between gap-2 border-b border-border/80 px-3 py-3 min-[400px]:gap-3 min-[400px]:px-5 min-[400px]:py-4">
          <div>
            {kicker ? (
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">{kicker}</p>
            ) : null}
            <h3 id="admin-modal-title" className="font-display text-lg font-extrabold text-foreground min-[400px]:text-xl">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border p-2 text-muted hover:bg-[#F5F6FA]"
            aria-label="Close"
          >
            <IoClose size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 min-[400px]:px-5 min-[400px]:py-4">
          {children}
        </div>
        {footer ? (
          <div className="border-t border-border/80 bg-[#FAFBFF] px-3 py-3 min-[400px]:px-5 min-[400px]:py-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

export function AdminPrimaryButton({
  children,
  onClick,
  disabled,
  variant = 'primary',
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  className?: string;
}) {
  const base =
    'w-full min-[400px]:w-auto rounded-full px-3 py-2 text-[12px] font-extrabold transition disabled:opacity-50 min-[400px]:px-4 min-[400px]:py-2.5 min-[400px]:text-[13px]';
  const variantCls =
    variant === 'primary'
      ? 'linkup-gradient-primary text-white shadow-md'
      : variant === 'danger'
        ? 'bg-red-600 text-white'
        : variant === 'secondary'
          ? 'border border-primary/30 bg-[#EDE8FF]/60 text-primary'
          : 'border border-border bg-white text-muted hover:bg-[#F5F6FA]';
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={cn(base, variantCls, className)}>
      {children}
    </button>
  );
}

/** @deprecated Use AdminListCard */
export const AdminStripeCard = AdminListCard;

export function AdminSearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full min-w-0 rounded-xl border border-border bg-white px-2.5 py-2 text-[13px] font-medium shadow-sm outline-none transition placeholder:text-muted focus:border-primary/40 focus:ring-2 focus:ring-primary/15 min-[360px]:rounded-2xl min-[360px]:px-3 min-[360px]:py-2.5 min-[360px]:text-[14px] min-[400px]:px-4 min-[400px]:py-3"
    />
  );
}
