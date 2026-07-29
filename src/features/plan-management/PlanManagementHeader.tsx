'use client';

import { CreatePlanLink } from '@/components/navigation/CreatePlanLink';
import { cn } from '@/utils/cn';
import { IoAdd, IoAlbums } from 'react-icons/io5';

const MOBILE_SUB =
  'Color-coded shelves for every stage, with the same energy as your wallet: clear, confident, ready to scale.';

const DESKTOP_SUB =
  'Color-coded shelves for every stage: create, edit, archive, and track views and offers.';

/** Matches Linkup app/settings/plan-management header row + subtitle. */
export function PlanManagementHeader() {
  return (
    <div className="w-full min-w-0 space-y-2 lg:space-y-3">
      <header className="pm-mobile-header flex w-full min-w-0 items-center">
        <div
          className={cn(
            'pm-header-icon pm-tap-target flex h-11 w-11 items-center justify-center rounded-xl linkup-gradient-primary text-white shadow-md min-[425px]:h-[52px] min-[425px]:w-[52px] min-[425px]:rounded-2xl'
          )}
        >
          <IoAlbums className="h-[22px] w-[22px] min-[425px]:h-[26px] min-[425px]:w-[26px]" aria-hidden />
        </div>

        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="pm-kicker text-secondary">Your catalog</p>
          <h1 className="pm-page-title font-display font-extrabold tracking-tight text-foreground">
            Plan management
          </h1>
        </div>

        <CreatePlanLink
          aria-label="Create plan"
          className={cn(
            'pm-header-create pm-tap-target inline-flex shrink-0 items-center justify-center rounded-full linkup-gradient-primary text-white shadow-md transition hover:opacity-95 active:scale-[0.98]',
            'h-11 w-11 min-[425px]:rounded-[400px]',
            'md:h-12 md:min-h-[48px] md:w-auto md:min-w-0 md:gap-2 md:rounded-full md:px-5'
          )}
        >
          <IoAdd className="h-5 w-5 shrink-0 md:hidden" aria-hidden />
          <span className="hidden text-[14px] font-extrabold md:inline">Create plan</span>
        </CreatePlanLink>
      </header>

      <p className="pm-mobile-sub font-semibold text-muted xl:hidden">{MOBILE_SUB}</p>
      <p className="pm-body-text hidden font-semibold leading-snug text-muted xl:block">{DESKTOP_SUB}</p>
    </div>
  );
}
