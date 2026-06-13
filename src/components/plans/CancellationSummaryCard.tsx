import { CancellationPolicyRows } from '@/components/plans/CancellationPolicyRows';
import { formatNGN } from '@/lib/escrow/escrowFormatters';
import { CANCELLATION_POLICY_TABLE_ROWS } from '@/lib/plans/cancellationPolicy';
import { IoSparkles } from 'react-icons/io5';

export type CancellationBandSummary = 'early' | 'late' | 'no_show' | 'mutual';

type OutcomeProps = {
  yourRefund: number;
  goodwillCredit: number;
  cancelType: 'early' | 'late' | 'no_show';
};

type Props = {
  outcome?: OutcomeProps | null;
};

export function CancellationSummaryCard({ outcome }: Props) {
  return (
    <section className="linkup-card space-y-4 p-5">
      <div>
        <h3 className="font-display text-lg font-extrabold text-foreground">Cancellation policy</h3>
        <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted">
          LinkUp applies role- and timing-based rules on the server so outcomes stay fair and predictable.
        </p>
      </div>
      <CancellationPolicyRows rows={CANCELLATION_POLICY_TABLE_ROWS} dense />
      {outcome ? (
        <div className="space-y-2 rounded-xl border border-border/60 bg-[#F5F6FA] p-4">
          <p className="text-[14px] font-extrabold text-foreground">Cancellation processed</p>
          <div className="flex items-center justify-between text-[14px]">
            <span className="font-semibold text-muted">Your refund</span>
            <span className="font-extrabold text-foreground">{formatNGN(outcome.yourRefund)}</span>
          </div>
          {outcome.goodwillCredit > 0 ? (
            <div className="flex items-center justify-between text-[14px]">
              <span className="flex items-center gap-1.5 font-semibold text-[#059669]">
                <IoSparkles size={14} />
                Goodwill credit
              </span>
              <span className="font-extrabold text-[#059669]">+{formatNGN(outcome.goodwillCredit)}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
