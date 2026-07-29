'use client';

import type { AdminTabId } from '@/features/admin/AdminShell.types';
import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';
import {
  IoAlbumsOutline,
  IoChatbubblesOutline,
  IoDocumentTextOutline,
  IoFlashOutline,
  IoGridOutline,
  IoFlagOutline,
  IoIdCardOutline,
  IoPeopleOutline,
  IoRefresh,
  IoScaleOutline,
  IoShieldCheckmark,
  IoStarOutline,
  IoWalletOutline,
} from 'react-icons/io5';

export type { AdminTabId } from '@/features/admin/AdminShell.types';

export type AdminTabDef = {
  id: AdminTabId;
  label: string;
  icon: ReactNode;
  badge?: number;
};

type Props = {
  tab: AdminTabId;
  onTabChange: (id: AdminTabId) => void;
  tabs: AdminTabDef[];
  stats: { label: string; value: number }[] | null;
  onRefresh: () => void;
  refreshing?: boolean;
  children: ReactNode;
};

export const ADMIN_TAB_ICONS: Record<AdminTabId, ReactNode> = {
  verify: <IoIdCardOutline size={18} />,
  reports: <IoFlagOutline size={18} />,
  moderation: <IoFlashOutline size={18} />,
  plan_disputes: <IoScaleOutline size={18} />,
  review_reports: <IoStarOutline size={18} />,
  support: <IoChatbubblesOutline size={18} />,
  users: <IoPeopleOutline size={18} />,
  plans: <IoAlbumsOutline size={18} />,
  privacy_policy: <IoDocumentTextOutline size={18} />,
  meet_types: <IoGridOutline size={18} />,
};

export function AdminShell({
  tab,
  onTabChange,
  tabs,
  stats,
  onRefresh,
  refreshing,
  children,
}: Props) {
  return (
    <div className="linkup-page-shell mx-auto w-full min-w-0 max-w-[1440px] px-1.5 pb-12 max-lg:pb-[var(--linkup-tab-clearance)] min-[360px]:px-2 min-[400px]:px-3 md:px-0">
      <div className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-[0_8px_28px_rgba(108,99,255,0.08)] min-[400px]:rounded-3xl min-[400px]:shadow-[0_12px_40px_rgba(108,99,255,0.1)]">
        <div className="bg-gradient-to-br from-[#EDE8FF] via-white to-[#FFF5F8] px-2 py-3 min-[360px]:px-3 min-[360px]:py-4 min-[400px]:px-5 min-[400px]:py-6 md:px-8 md:py-7">
          <div className="flex flex-col gap-2 min-[360px]:gap-3 min-[400px]:flex-row min-[400px]:flex-wrap min-[400px]:items-start min-[400px]:justify-between min-[400px]:gap-4">
            <div className="flex min-w-0 gap-1.5 min-[360px]:gap-2 min-[400px]:gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg linkup-gradient-primary shadow-lg shadow-primary/25 min-[360px]:h-10 min-[360px]:w-10 min-[360px]:rounded-xl min-[400px]:h-14 min-[400px]:w-14 min-[400px]:rounded-2xl">
                <IoShieldCheckmark size={22} className="text-white min-[400px]:hidden" />
                <IoShieldCheckmark size={28} className="hidden text-white min-[400px]:block" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-secondary min-[400px]:text-[11px] min-[400px]:tracking-[0.12em]">
                  Trust & safety
                </p>
                <h1 className="font-display text-base font-extrabold tracking-tight text-foreground min-[360px]:text-lg min-[400px]:text-2xl md:text-3xl">
                  Admin
                </h1>
                <p className="mt-1 hidden max-w-xl text-[12px] font-semibold leading-relaxed text-muted min-[400px]:block min-[400px]:text-[14px]">
                  Priority queues, audit trails, and resolution tools to keep the community confident.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={refreshing}
              onClick={onRefresh}
              className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-full linkup-gradient-primary px-3 py-2 text-[11px] font-extrabold text-white shadow-md transition hover:opacity-95 disabled:opacity-60 min-[360px]:gap-2 min-[360px]:px-4 min-[360px]:py-2.5 min-[360px]:text-[12px] min-[400px]:w-auto min-[400px]:px-5 min-[400px]:text-[13px]"
            >
              <IoRefresh size={18} className={refreshing ? 'animate-spin' : undefined} />
              Refresh
            </button>
          </div>

          {stats && stats.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-1 min-[360px]:mt-4 min-[360px]:gap-1.5 min-[400px]:mt-6 min-[400px]:gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="min-w-0 rounded-lg border border-white/80 bg-white/90 px-1 py-1.5 text-center shadow-sm backdrop-blur-sm min-[360px]:rounded-xl min-[360px]:px-1.5 min-[360px]:py-2 min-[400px]:rounded-2xl min-[400px]:px-3 min-[400px]:py-3"
                >
                  <p className="font-display text-base font-extrabold text-primary min-[360px]:text-lg min-[400px]:text-2xl">{s.value}</p>
                  <p className="mt-0.5 break-words text-[7px] font-extrabold uppercase leading-tight tracking-wide text-muted min-[360px]:text-[8px] min-[400px]:text-[10px]">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="border-b border-border/80 bg-white/95 px-1.5 py-1.5 min-[360px]:px-2 min-[360px]:py-2 min-[400px]:px-3 min-[400px]:py-3 md:px-6">
          <div className="flex min-w-0 gap-1 overflow-x-auto overscroll-x-contain pb-0.5 scrollbar-none min-[360px]:gap-1.5 min-[400px]:gap-2">
            {tabs.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTabChange(t.id)}
                  aria-label={t.label}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1.5 text-[10px] font-extrabold transition min-[360px]:gap-1.5 min-[360px]:rounded-xl min-[360px]:px-2 min-[360px]:py-2 min-[360px]:text-[11px] min-[400px]:gap-2 min-[400px]:rounded-2xl min-[400px]:px-3.5 min-[400px]:py-2.5 min-[400px]:text-[13px]',
                    active
                      ? 'linkup-gradient-primary text-white shadow-md'
                      : 'border border-border bg-[#FAFBFF] text-muted hover:border-primary/25 hover:text-foreground'
                  )}
                >
                  <span className={active ? 'text-white' : 'text-primary'}>{t.icon}</span>
                  <span className="hidden min-[400px]:inline">{t.label}</span>
                  {t.badge != null && t.badge > 0 ? (
                    <span
                      className={cn(
                        'min-w-[18px] rounded-full px-1 py-0.5 text-center text-[9px] font-extrabold min-[400px]:min-w-[20px] min-[400px]:px-1.5 min-[400px]:text-[10px]',
                        active ? 'bg-white/25 text-white' : 'bg-secondary text-white'
                      )}
                    >
                      {t.badge > 99 ? '99+' : t.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-[280px] min-w-0 bg-[#F8F9FC]/50 px-1.5 py-3 min-[360px]:px-2 min-[360px]:py-4 min-[400px]:min-h-[480px] min-[400px]:px-4 min-[400px]:py-6 md:px-8">
          {children}
        </div>
      </div>
    </div>
  );
}
