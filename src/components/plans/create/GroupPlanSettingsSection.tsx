'use client';

import { MultiCitySelector } from '@/components/plans/create/MultiCitySelector';
import { TierBadge } from '@/components/subscription/TierBadge';
import { ToggleSwitch } from '@/components/settings/ToggleRow';
import { useGatedAction } from '@/contexts/UpgradeGateContext';
import { usePermission } from '@/hooks/usePermission';
import { useSubscriptionContext } from '@/lib/subscription/SubscriptionContext';
import { cn } from '@/utils/cn';
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

  if (!visible || !draft.isGroupPlan) return null;

  const caps = (() => {
    const raw = metadata?.group_plan_caps as
      | { max_free_guests?: number; max_premium_guests?: number }
      | undefined;
    return {
      maxFreeGuests: raw?.max_free_guests ?? (effectiveTier === 'PLATINUM' ? 10 : 5),
    };
  })();

  const minGuests = 2;
  const maxGuests = Math.max(minGuests, draft.maxGuests);

  function bumpGuests(delta: number) {
    onChange({
      maxGuests: Math.max(minGuests, draft.maxGuests + delta),
      maxFreeGuests: caps.maxFreeGuests,
    });
  }

  return (
    <div className="mt-4 space-y-4 rounded-2xl border border-primary/20 bg-[#EDE8FF]/30 p-4">
      <h3 className="font-display text-[15px] font-extrabold text-foreground">Group settings</h3>

      <div>
        <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Maximum guests</p>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => bumpGuests(-1)}
            disabled={maxGuests <= minGuests}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-white disabled:opacity-40"
            aria-label="Decrease guests"
          >
            <IoRemove size={18} />
          </button>
          <span className="min-w-[2rem] text-center text-xl font-extrabold">{maxGuests}</span>
          <button
            type="button"
            onClick={() => bumpGuests(1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-white"
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
