import type { DbPlan } from '@/types/database';

export function getPlanCalendarTimes(plan: DbPlan): { start: Date; end: Date } | null {
  const raw = plan.agreed_scheduled_at ?? plan.scheduled_at;
  if (!raw) return null;
  const start = new Date(raw);
  if (Number.isNaN(start.getTime())) return null;
  const durationMs = (plan.duration_minutes ?? 120) * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);
  return { start, end };
}

export function planCanAddToCalendar(plan: DbPlan): boolean {
  return getPlanCalendarTimes(plan) != null;
}

function formatIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** Download a `.ics` file — works with Google Calendar, Apple Calendar, and Outlook. */
export function downloadPlanCalendarIcs(plan: DbPlan, planId: string): { ok: true } | { ok: false; message: string } {
  const times = getPlanCalendarTimes(plan);
  if (!times) {
    return { ok: false, message: 'This plan does not have a scheduled time yet.' };
  }

  const notes = [plan.description?.trim(), plan.location_label?.trim()].filter(Boolean).join('\n\n');
  const location = (plan.agreed_location ?? plan.location_label)?.trim() || '';

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LinkUp//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:linkup-${planId}@linkup.app`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(times.start)}`,
    `DTEND:${formatIcsDate(times.end)}`,
    `SUMMARY:${escapeIcsText(`LinkUp: ${plan.title}`)}`,
    notes ? `DESCRIPTION:${escapeIcsText(notes)}` : '',
    location ? `LOCATION:${escapeIcsText(location)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `linkup-plan-${planId}.ics`;
  anchor.click();
  URL.revokeObjectURL(url);

  return { ok: true };
}
