import type { PolicyTableRow } from '@/lib/plans/cancellationPolicy';
import { cn } from '@/utils/cn';

type Props = {
  rows: readonly PolicyTableRow[];
  dense?: boolean;
};

function toneDot(tone: PolicyTableRow['tone']): string {
  if (tone === 'ok') return 'bg-[#10B981]';
  if (tone === 'warn') return 'bg-secondary';
  return 'bg-muted';
}

function PolicyRow({ label, value, tone, dense }: PolicyTableRow & { dense?: boolean }) {
  return (
    <div className={cn('flex items-start gap-2.5', dense ? 'gap-2' : '')}>
      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', toneDot(tone))} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={cn('font-extrabold text-foreground', dense ? 'text-[13px]' : 'text-[14px]')}>{label}</p>
        <p className={cn('mt-0.5 font-semibold text-muted', dense ? 'text-[12px] leading-relaxed' : 'text-[13px] leading-relaxed')}>
          {value}
        </p>
      </div>
    </div>
  );
}

export function CancellationPolicyRows({ rows, dense }: Props) {
  return (
    <div className={cn('space-y-3', dense && 'space-y-2')}>
      {rows.map((row) => (
        <PolicyRow key={row.label} {...row} dense={dense} />
      ))}
    </div>
  );
}
