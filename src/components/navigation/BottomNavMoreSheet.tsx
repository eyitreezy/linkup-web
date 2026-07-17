'use client';

import { TabIcon, type TabIconName } from '@/components/navigation/TabIcon';
import type { NavTabItem } from '@/components/navigation/tabNavConfig';
import { isMainNavItemActive } from '@/lib/navigation/navActive';
import { shouldPrefetchNavRoute } from '@/lib/navigation/prefetchNav';
import { NavItemUnreadIndicator } from '@/components/navigation/NavItemUnreadIndicator';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { IoClose } from 'react-icons/io5';

type Props = {
  open: boolean;
  onClose: () => void;
  items: readonly NavTabItem[];
};

export function BottomNavMoreSheet({ open, onClose, items }: Props) {
  const pathname = usePathname();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="More navigation">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div
        className="absolute bottom-0 left-0 right-0 max-h-[min(70vh,420px)] overflow-hidden rounded-t-3xl border border-border bg-surface shadow-2xl"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
          <p className="font-display text-lg font-extrabold text-foreground">More</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border p-2 text-muted hover:bg-[#EDE8FF]/50"
            aria-label="Close"
          >
            <IoClose size={20} />
          </button>
        </div>
        <ul className="grid grid-cols-2 gap-2 overflow-y-auto p-3 min-[400px]:grid-cols-3">
          {items.map((item) => {
            const active = isMainNavItemActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch={shouldPrefetchNavRoute(item.href)}
                  onClick={onClose}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 transition active:scale-[0.98]',
                    active
                      ? 'linkup-gradient-primary border-transparent text-white shadow-md'
                      : 'border-border bg-white text-muted hover:border-primary/25 hover:text-foreground'
                  )}
                >
                  <TabIcon
                    name={item.icon as TabIconName}
                    size={26}
                    className={active ? 'text-white' : 'text-primary'}
                  />
                  <span className="text-center text-[12px] font-extrabold leading-tight">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** Compact “More” tab button for the bottom bar. */
export function BottomNavMoreButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={undefined}
      aria-haspopup="dialog"
      className={cn(
        'flex w-full flex-col items-center gap-0.5 px-0.5 py-0.5 transition active:scale-95 min-[360px]:gap-1',
        active ? 'text-primary' : 'text-[#6B7280]'
      )}
    >
      <NavItemUnreadIndicator count={0} showDot={false} active={active} ringClassName="ring-surface/95">
        <span
          className={cn(
            'flex h-5 w-5 items-center justify-center text-[18px] font-black leading-none min-[360px]:h-6 min-[360px]:w-6 min-[360px]:text-[20px]',
            active ? 'text-primary' : 'text-[#6B7280]'
          )}
          aria-hidden
        >
          ⋯
        </span>
      </NavItemUnreadIndicator>
      <span className="w-full max-w-[4.25rem] truncate text-center text-[9px] font-semibold leading-tight tracking-tight min-[360px]:max-w-none min-[360px]:text-[10px]">
        More
      </span>
    </button>
  );
}
