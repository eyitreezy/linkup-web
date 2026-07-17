import type { IconType } from 'react-icons';
import { IoCashOutline, IoDocumentTextOutline, IoLocationOutline, IoTimeOutline } from 'react-icons/io5';

type RowProps = {
  icon: IconType;
  label: string;
  value: string;
  emphasize?: boolean;
};

function SummaryRow({ icon: Icon, label, value, emphasize }: RowProps) {
  return (
    <div
      className={
        emphasize
          ? '-mx-5 flex items-start gap-3 border-t border-primary/10 bg-primary/[0.06] px-5 py-4'
          : 'flex items-start gap-3 border-t border-primary/10 py-4'
      }
    >
      <div className="flex w-9 shrink-0 justify-center pt-0.5">
        <Icon className={emphasize ? 'text-primary' : 'text-muted'} size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[13px] font-bold text-muted">{label}</p>
        <p className={emphasize ? 'text-[17px] font-extrabold text-foreground' : 'text-[16px] font-semibold text-foreground'}>
          {value}
        </p>
      </div>
    </div>
  );
}

type Props = {
  planTitle: string;
  location: string | null;
  whenLabel: string;
  priceLabel: string;
  notes: string | null;
};

export function PlanSummaryCard({ planTitle, location, whenLabel, priceLabel, notes }: Props) {
  return (
    <section className="linkup-card border-primary/10 p-5 shadow-[0_8px_18px_rgba(42,31,85,0.09)]">
      <p className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-muted">Plan summary</p>
      <h2 className="mb-4 font-display text-xl font-extrabold leading-snug text-foreground">{planTitle}</h2>
      <SummaryRow icon={IoLocationOutline} label="Location" value={location ?? 'Location TBD'} />
      <SummaryRow icon={IoTimeOutline} label="Time & date" value={whenLabel} emphasize />
      <SummaryRow icon={IoCashOutline} label="Agreed price" value={priceLabel} emphasize />
      {notes ? <SummaryRow icon={IoDocumentTextOutline} label="Notes" value={notes} /> : null}
    </section>
  );
}
