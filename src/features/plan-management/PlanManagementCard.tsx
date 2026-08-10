'use client';

import { getCreatorEditCapabilities } from '@/lib/plans/planCreatorEditPolicy';
import {
  isMoodExpired,
  moodLive,
  planStripeKind,
  type CreatorPlanRow,
} from '@/lib/plans/planManagement';
import { pmActionBtn, pmActionScroller } from '@/features/plan-management/planManagementLayout';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { IoBookmarkOutline, IoChatbubblesOutline, IoEyeOutline } from 'react-icons/io5';

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
  const ended = plan.is_mood_plan && isMoodExpired(plan);
  const engagementTotal = views + saves;

  return (
    <article className="pm-card flex w-full min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-white/90 shadow-sm transition hover:border-primary/20 hover:shadow-md min-[425px]:rounded-[18px]">
      <div className={cn('w-1 shrink-0', STRIPE[planStripeKind(plan)])} aria-hidden />
      <div className="min-w-0 flex-1 p-3 min-[425px]:p-4">
        <div className="pm-card-head">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="pm-card-title font-display text-foreground">{plan.title}</h3>
              {hasNewActivity ? (
                <span className="inline-flex items-center rounded-full bg-secondary/90 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white">
                  new
                </span>
              ) : null}
            </div>
            <p className="pm-card-meta mt-1 font-semibold text-muted">
              {plan.status}
              {plan.is_mood_plan ? ' · Mood' : ''}
              {distanceKm != null ? ` · ${Math.round(distanceKm)} km` : ''}
            </p>
          </div>
          {live && plan.mood_expires_at ? (
            <span className="pm-status-badge inline-flex shrink-0 self-start rounded-full bg-secondary/15 px-3 py-1 text-secondary">
              Live
            </span>
          ) : ended ? (
            <span className="pm-status-badge inline-flex shrink-0 self-start rounded-full bg-slate-500/15 px-3 py-1 text-slate-600">
              Ended
            </span>
          ) : null}
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
            href={`/plan/${plan.id}`}
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
