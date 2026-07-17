type Props = {
  primary: string;
  secondary: string;
};

export function PlanAgreementStatusBadge({ primary, secondary }: Props) {
  return (
    <div className="flex flex-col items-center px-1 text-center">
      <div className="mb-2 rounded-full linkup-gradient-primary p-[2px]">
        <div className="rounded-full bg-white/98 px-4 py-2">
          <p className="text-[13px] font-extrabold tracking-wide text-primary">{primary}</p>
        </div>
      </div>
      <p className="max-w-md text-[15px] font-semibold leading-relaxed text-muted">{secondary}</p>
    </div>
  );
}
