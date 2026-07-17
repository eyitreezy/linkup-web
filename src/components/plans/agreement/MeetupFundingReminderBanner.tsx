import { meetupHoursUntilLabel } from '@/lib/escrow/escrowPaymentPreview';
import { IoAlarmOutline, IoNotificationsOutline } from 'react-icons/io5';

type Props = {
  meetupIso: string | null | undefined;
  role: 'payer' | 'host_waiting';
};

export function MeetupFundingReminderBanner({ meetupIso, role }: Props) {
  const when = meetupHoursUntilLabel(meetupIso);
  if (!when) return null;

  const title = role === 'payer' ? 'Meetup coming up. Fund escrow' : 'Meetup soon. Waiting on payment';
  const sub =
    role === 'payer'
      ? `Your plan starts ${when}. Complete secure payment on the next screen so you're covered before you meet.`
      : `Your plan starts ${when}. We'll notify you when your guest funds escrow. You can message them from here if needed.`;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-amber-300/50 bg-white p-5">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-r from-amber-200/30 via-secondary/5 to-transparent"
        aria-hidden
      />
      <div className="relative flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-300/40 bg-amber-100/80 text-amber-600">
          <IoAlarmOutline size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-amber-600">Time-sensitive</p>
          <p className="mt-1 text-[16px] font-extrabold text-foreground">{title}</p>
          <p className="mt-1 text-[14px] font-semibold leading-relaxed text-muted">{sub}</p>
          <div className="mt-3 flex items-start gap-2 border-t border-amber-200/40 pt-3">
            <IoNotificationsOutline className="mt-0.5 shrink-0 text-muted" size={14} />
            <p className="text-[12px] font-semibold leading-relaxed text-muted">
              Automated push and email reminders run if notifications are on in Settings.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
