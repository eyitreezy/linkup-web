import { APP_NAME } from '@/lib/brand';
import { planShareHostFirstName } from '@/lib/plans/planSharePreview';

type Props = {
  meetTypeName: string;
  title: string;
  city: string;
  meetDateLabel: string | null;
  priceLabel: string | null;
  hostDisplayName: string | null;
};

/** In-modal preview of the share card (matches OG layout; avoids relying on /api PNG in the dialog). */
export function PlanShareCardPreview({
  meetTypeName,
  title,
  city,
  meetDateLabel,
  priceLabel,
  hostDisplayName,
}: Props) {
  const hostName = planShareHostFirstName(hostDisplayName);

  return (
    <div className="w-full rounded-2xl bg-gradient-to-br from-primary to-secondary p-3 sm:p-4">
      <div className="flex flex-col gap-2.5 rounded-[1.25rem] bg-white p-4 sm:gap-3 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-extrabold text-primary sm:text-base">{APP_NAME}</span>
          <span className="shrink-0 rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-semibold text-primary sm:text-xs">
            Verified Meetup
          </span>
        </div>

        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-semibold text-muted sm:text-xs">{meetTypeName}</p>
          <p className="break-words text-base font-extrabold leading-snug text-foreground sm:text-lg">
            {title}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-foreground sm:text-xs">
          {meetDateLabel ? <span className="shrink-0">{meetDateLabel}</span> : null}
          {meetDateLabel && city ? (
            <span className="text-muted" aria-hidden>
              ·
            </span>
          ) : null}
          <span className="min-w-0 break-words">{city || 'Date TBC'}</span>
          {priceLabel ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-extrabold text-emerald-700">
              {priceLabel}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-xs">
          <span className="text-muted">Hosted by</span>
          <span className="font-extrabold text-foreground">{hostName}</span>
          <span className="font-semibold text-primary">Verified</span>
        </div>
      </div>
    </div>
  );
}
