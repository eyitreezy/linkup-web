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
    <div className="aspect-[1200/630] w-full rounded-2xl bg-gradient-to-br from-primary to-secondary p-[5%]">
      <div className="flex h-full flex-col gap-3 rounded-[1.25rem] bg-white p-[6%]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-extrabold text-primary sm:text-base">{APP_NAME}</span>
          <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-semibold text-primary sm:text-xs">
            Verified Meetup
          </span>
        </div>

        <div className="min-h-0 flex-1 space-y-1">
          <p className="text-[10px] font-semibold text-muted sm:text-xs">{meetTypeName}</p>
          <p className="line-clamp-3 text-base font-extrabold leading-tight text-foreground sm:text-lg">
            {title}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-foreground sm:text-xs">
          <span>{meetDateLabel ?? 'Date TBC'}</span>
          <span>{city}</span>
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
