'use client';

import { MultiCitySelector } from '@/components/plans/create/MultiCitySelector';
import { TierBadge } from '@/components/subscription/TierBadge';
import { ToggleSwitch } from '@/components/settings/ToggleRow';
import { useGatedAction } from '@/contexts/UpgradeGateContext';
import { usePermission } from '@/hooks/usePermission';
import {
  clampGroupMaxGuests,
  MIN_GROUP_MAX_GUESTS,
  parseGroupMaxGuestsInput,
} from '@/lib/plans/groupPlanLimits';
import { useSubscriptionContext } from '@/lib/subscription/SubscriptionContext';
import { cn } from '@/utils/cn';
import { useEffect, useState } from 'react';
import { IoAdd, IoRemove } from 'react-icons/io5';

export type GroupPlanDraft = {
  isGroupPlan: boolean;
  maxGuests: number;
  maxFreeGuests: number;
  maxPremiumGuests: number | null;
  multiCity: boolean;
  cityIds: string[];
};

type Props = {
  visible: boolean;
  draft: GroupPlanDraft;
  onChange: (patch: Partial<GroupPlanDraft>) => void;
  /** Surface multi-city min selection after a failed publish. */
  showCityValidation?: boolean;
};

export function GroupPlanSettingsSection({ visible, draft, onChange, showCityValidation }: Props) {
  const { subscriptionState } = useSubscriptionContext();
  const { effectiveTier, metadata } = usePermission('group_plan.host', { skip: !visible });
  const multiCityPerm = usePermission('group_plan.multi_city', { skip: !visible || !draft.isGroupPlan });
  const runGated = useGatedAction();
  const [focused, setFocused] = useState(false);
  const [draftInput, setDraftInput] = useState(String(draft.maxGuests));

  useEffect(() => {
    if (!focused) {
      setDraftInput(String(clampGroupMaxGuests(draft.maxGuests)));
    }
  }, [draft.maxGuests, focused]);

  if (!visible || !draft.isGroupPlan) return null;

  const caps = (() => {
    const raw = metadata?.group_plan_caps as
      | { max_free_guests?: number; max_premium_guests?: number }
      | undefined;
    return {
      maxFreeGuests: raw?.max_free_guests ?? (effectiveTier === 'PLATINUM' ? 10 : 5),
    };
  })();

  const maxGuests = clampGroupMaxGuests(draft.maxGuests);

  function commitGuests(next: number) {
    const clamped = clampGroupMaxGuests(next);
    onChange({
      maxGuests: clamped,
      maxFreeGuests: caps.maxFreeGuests,
    });
    setDraftInput(String(clamped));
  }

  function handleBlurInput() {
    setFocused(false);
    commitGuests(parseGroupMaxGuestsInput(draftInput, maxGuests));
  }

  return (
    <div className="mt-4 space-y-4 rounded-2xl border border-primary/20 bg-[#EDE8FF]/30 p-4">
      <h3 className="font-display text-[15px] font-extrabold text-foreground">Group settings</h3>

      <div>
        <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Maximum guests</p>
        <p className="mt-0.5 text-[12px] font-semibold text-muted">
          Minimum {MIN_GROUP_MAX_GUESTS} guests required for group plans.
        </p>
        <div className="mt-2 inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-white p-1.5 shadow-sm">
          <button
            type="button"
            onClick={() => commitGuests(maxGuests - 1)}
            disabled={maxGuests <= MIN_GROUP_MAX_GUESTS}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/15 bg-[#FAFBFF] text-primary transition hover:bg-[#EDE8FF]/60 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Decrease guests"
          >
            <IoRemove size={18} />
          </button>

          <div className="relative min-w-[3.25rem]">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={focused ? draftInput : String(maxGuests)}
              onFocus={() => {
                setFocused(true);
                setDraftInput(String(maxGuests));
              }}
              onChange={(e) => {
                const next = e.target.value.replace(/[^\d]/g, '');
                setDraftInput(next);
              }}
              onBlur={handleBlurInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
              aria-label="Maximum guests"
              className={cn(
                'w-full bg-transparent text-center text-xl font-extrabold text-foreground outline-none transition',
                focused
                  ? 'rounded-lg border border-primary/30 bg-[#EDE8FF]/30 px-2 py-1 ring-2 ring-primary/15'
                  : 'border border-transparent px-2 py-1'
              )}
            />
          </div>

          <button
            type="button"
            onClick={() => commitGuests(maxGuests + 1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/15 bg-[#FAFBFF] text-primary transition hover:bg-[#EDE8FF]/60"
            aria-label="Increase guests"
          >
            <IoAdd size={18} />
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-white/80 px-3 py-2.5 text-[13px] font-semibold text-muted">
        Up to{' '}
        <span className="font-extrabold text-foreground">
          {subscriptionState.effectiveTier === 'PLATINUM' ? 10 : 5}
        </span>{' '}
        free-tier guests allowed
      </div>

      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-xl border border-border bg-white px-3 py-3',
          !multiCityPerm.allowed && 'opacity-80'
        )}
      >
        <div className="min-w-0">
          <p className="text-[14px] font-extrabold text-foreground">Visible across multiple cities</p>
          <p className="text-[12px] font-semibold text-muted">Platinum exclusive</p>
        </div>
        {multiCityPerm.allowed ? (
          <ToggleSwitch
            id="multi-city"
            checked={draft.multiCity}
            onChange={(v) => {
              if (!v) {
                onChange({ multiCity: false, cityIds: [] });
                return;
              }
              onChange({ multiCity: true });
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => void runGated('group_plan.multi_city', () => {})}
            className="shrink-0"
          >
            <TierBadge tier="PLATINUM" size="sm" />
          </button>
        )}
      </div>

      {draft.multiCity && multiCityPerm.allowed ? (
        <MultiCitySelector
          selected={draft.cityIds}
          showValidation={showCityValidation}
          onChange={(cityIds) => onChange({ cityIds, multiCity: true })}
        />
      ) : null}
    </div>
  );
}
