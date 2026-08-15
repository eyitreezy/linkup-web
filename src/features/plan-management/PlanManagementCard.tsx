'use client';

import { DiscoverPlanTypePillBadge } from '@/components/plans/discover/DiscoverPlanTypePillBadge';
import { getCreatorEditCapabilities } from '@/lib/plans/planCreatorEditPolicy';
import { formatPlanWhen } from '@/lib/plans/formatPlanMeta';
import {
  isCreatorPlanListingExpired,
  moodLive,
  planStripeKind,
  type CreatorPlanRow,
} from '@/lib/plans/planManagement';
import { PLAN_DETAIL_FROM, planDetailHref } from '@/lib/plans/planDetailNavigation';
import { pmActionBtn, pmActionScroller } from '@/features/plan-management/planManagementLayout';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { IoBookmarkOutline, IoChatbubblesOutline, IoEyeOutline, IoLocationOutline } from 'react-icons/io5';

const STRIPE: Record<ReturnType<typeof planStripeKind>, string> = {
  default: 'bg-primary',
  mood: 'bg-secondary',
  draft: 'bg-[#F59E0B]',
  expired: 'bg-[#64748B]',
  archived: 'bg-[#94A3B8]',
};

type Props = {
  plan: CreatorPlanRow;
  views: number;
  saves: number;
  offers: number;
  distanceKm: number | null;
  hasNewActivity: boolean;
  onMarkRead: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
};

const deleteBtnClass =
  'pm-action-tap inline-flex shrink-0 grow-0 basis-auto items-center rounded-full border border-[#FECACA] bg-[#FEF2F2] font-extrabold text-[#EF4444] transition hover:opacity-90 px-3.5 py-2 text-[14px]';

export function PlanManagementCard({
  plan,
  views,
  saves,
  offers,
  distanceKm,
  hasNewActivity,
  onMarkRead,
  onEdit,
  onDuplicate,
  onArchive,
  onRestore,
  onDelete,
}: Props) {
  const caps = getCreatorEditCapabilities(plan, offers);
  const live = moodLive(plan);
  const listingExpired = isCreatorPlanListingExpired(plan);
  const engagementTotal = views + saves;
  const whenLabel = formatPlanWhen(plan);
  const priceLabel =
    plan.starting_price_cents && plan.starting_price_cents > 0
      ? `From ₦${(plan.starting_price_cents / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`
      : 'Free';

  return (
    <article
      className={cn(
        'pm-card flex w-full min-w-0 overflow-hidden rounded-2xl border bg-white/90 shadow-sm transition min-[425px]:rounded-[18px]',
        listingExpired
          ? 'border-slate-200/90 opacity-[0.92] hover:border-slate-300'
          : 'border-border/80 hover:border-primary/20 hover:shadow-md'
      )}
    >
      <div className={cn('w-1 shrink-0', STRIPE[planStripeKind(plan)])} aria-hidden />
      <div className="min-w-0 flex-1 p-3 min-[425px]:p-4">
        <div className="pm-card-head">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <DiscoverPlanTypePillBadge plan={plan} className="px-2.5 py-1 text-[10px]" />
              {listingExpired ? (
                <span className="inline-flex rounded-full bg-slate-500/12 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-600">
                  Expired
                </span>
              ) : live ? (
                <span className="inline-flex rounded-full bg-secondary/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-secondary">
                  Live
                </span>
              ) : null}
              {hasNewActivity ? (
                <span className="inline-flex items-center rounded-full bg-secondary/90 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white">
                  new
                </span>
              ) : null}
            </div>
            <h3 className="pm-card-title font-display text-foreground">{plan.title}</h3>
            <p className="pm-card-meta font-semibold capitalize text-muted">
              {plan.status.replace(/_/g, ' ')}
              {distanceKm != null ? ` · ${Math.round(distanceKm)} km` : ''}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold text-muted">
              {whenLabel ? <span>{whenLabel}</span> : null}
              {plan.location_label ? (
                <span className="inline-flex max-w-full items-center gap-1 truncate">
                  <IoLocationOutline className="shrink-0" size={14} />
                  {plan.location_label}
                </span>
              ) : null}
              <span>{priceLabel}</span>
            </div>
          </div>
        </div>

        <div className="pm-card-metrics mt-3 min-[425px]:mt-3">
          <span className="pm-card-metric bg-primary/5 text-muted">
            <IoEyeOutline className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            {views} views
          </span>
          <span className="pm-card-metric bg-primary/5 text-muted">
            <IoBookmarkOutline className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            {saves} saves
          </span>
          <span className="pm-card-metric bg-primary/5 text-muted">
            <IoChatbubblesOutline className="h-4 w-4 shrink-0 text-secondary" aria-hidden />
            {offers} offers
          </span>
        </div>

        <div className={cn(pmActionScroller)}>
          <Link
            href={planDetailHref(plan.id, PLAN_DETAIL_FROM.planManagement)}
            className={pmActionBtn}
            onClick={() => onMarkRead()}
          >
            Open
          </Link>
          {plan.status !== 'draft' ? (
            <Link href={`/plan/${plan.id}/interest`} className={pmActionBtn}>
              Interest
              {engagementTotal > 0 ? (
                <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-extrabold text-primary">
                  {engagementTotal}
                </span>
              ) : null}
            </Link>
          ) : null}
          {caps.canEdit ? (
            <button type="button" onClick={onEdit} className={pmActionBtn}>
              Edit
            </button>
          ) : null}
          <button type="button" onClick={onDuplicate} className={pmActionBtn}>
            Duplicate
          </button>
          {plan.status !== 'draft' && !plan.archived_at ? (
            <button type="button" onClick={onArchive} className={pmActionBtn}>
              Archive
            </button>
          ) : null}
          {plan.archived_at ? (
            <button type="button" onClick={onRestore} className={pmActionBtn}>
              Restore
            </button>
          ) : null}
          {plan.status === 'draft' ? (
            <button type="button" onClick={onDelete} className={deleteBtnClass}>
              Delete
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
