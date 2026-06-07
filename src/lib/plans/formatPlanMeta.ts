import type { DbPlan } from '@/types/database';

/** Fixed locale so SSR (Node) and hydration (browser) render the same strings. */
const DISPLAY_LOCALE = 'en-US';

export function formatPlanWhen(plan: DbPlan): string {
  const d = plan.scheduled_at ? new Date(plan.scheduled_at) : new Date(plan.created_at);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear();

  const time = d.toLocaleTimeString(DISPLAY_LOCALE, { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today, ${time}`;
  if (isTomorrow) return `Tomorrow, ${time}`;
  return (
    d.toLocaleDateString(DISPLAY_LOCALE, { weekday: 'short', month: 'short', day: 'numeric' }) +
    `, ${time}`
  );
}

export function formatPlanPrice(plan: DbPlan): string | null {
  if (plan.starting_price_cents == null) return null;
  const v = (plan.starting_price_cents / 100).toLocaleString(DISPLAY_LOCALE);
  return `₦${v}`;
}
