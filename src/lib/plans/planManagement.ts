import { isPlanMoodWindowClosed } from '@/lib/plans/planExpiry';
import type { DbMeetType, DbPlan } from '@/types/database';

export type CreatorPlanRow = DbPlan & { meet_types?: DbMeetType | null };

export type PlanManagementSection =
  | 'all'
  | 'active'
  | 'mood'
  | 'expired'
  | 'drafts'
  | 'archived';

export type PlanSortKey = 'newest' | 'oldest' | 'expiring';

export function isMoodExpired(p: CreatorPlanRow): boolean {
  return (
    !!p.is_mood_plan &&
    (!!p.is_expired || (p.mood_expires_at != null && new Date(p.mood_expires_at).getTime() <= Date.now()))
  );
}

export function planMatchesSection(p: CreatorPlanRow, section: PlanManagementSection): boolean {
  const archived = p.archived_at != null;
  const expiredMood = isMoodExpired(p);

  switch (section) {
    case 'all':
      return true;
    case 'active':
      return (
        !archived &&
        !expiredMood &&
        ['negotiating', 'active', 'agreed', 'awaiting_payment'].includes(p.status)
      );
    case 'mood':
      return !archived && !!p.is_mood_plan;
    case 'expired':
      return !archived && expiredMood;
    case 'drafts':
      return p.status === 'draft' && !archived;
    case 'archived':
      return archived;
    default:
      return true;
  }
}

export function sortCreatorPlans(list: CreatorPlanRow[], sort: PlanSortKey): CreatorPlanRow[] {
  const copy = [...list];
  if (sort === 'expiring') {
    copy.sort((a, b) => {
      const ta = a.mood_expires_at ? new Date(a.mood_expires_at).getTime() : Infinity;
      const tb = b.mood_expires_at ? new Date(b.mood_expires_at).getTime() : Infinity;
      return ta - tb;
    });
    return copy;
  }
  const dir = sort === 'oldest' ? 1 : -1;
  copy.sort((a, b) => dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
  return copy;
}

export function planSearchBlob(p: CreatorPlanRow): string {
  return [
    p.title,
    p.description,
    p.location_label,
    p.category,
    p.mood_type,
    p.meet_types?.name,
    p.meet_types?.slug,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function countBySection(plans: CreatorPlanRow[]): Record<PlanManagementSection, number> {
  const keys: PlanManagementSection[] = ['all', 'active', 'mood', 'expired', 'drafts', 'archived'];
  const out = {} as Record<PlanManagementSection, number>;
  for (const k of keys) {
    out[k] = plans.filter((p) => planMatchesSection(p, k)).length;
  }
  return out;
}

export function planStripeKind(
  p: CreatorPlanRow
): 'default' | 'mood' | 'draft' | 'expired' | 'archived' {
  if (p.archived_at) return 'archived';
  if (p.status === 'draft') return 'draft';
  if (isMoodExpired(p)) return 'expired';
  if (p.is_mood_plan) return 'mood';
  return 'default';
}

export function moodLive(p: CreatorPlanRow): boolean {
  return !!p.is_mood_plan && !isPlanMoodWindowClosed(p);
}
