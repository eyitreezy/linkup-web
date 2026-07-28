'use client';

import { CancellationPolicyRows } from '@/components/plans/CancellationPolicyRows';
import { formatNGN } from '@/lib/escrow/escrowFormatters';
import {
  fetchCancellationMatrixRows,
  fetchNoShowMatrixRows,
} from '@/lib/plans/cancellationMatrix';
import { CANCELLATION_POLICY_TABLE_ROWS } from '@/lib/plans/cancellationPolicy';
import type { EscrowPattern } from '@/types/database';
import { useEffect, useState } from 'react';
import { IoChevronDown, IoChevronUp, IoSparkles } from 'react-icons/io5';

export type CancellationBandSummary = 'early' | 'late' | 'no_show' | 'mutual';

type OutcomeProps = {
  yourRefund: number;
  goodwillCredit: number;
  cancelType: 'early' | 'late' | 'no_show';
};

type Props = {
  outcome?: OutcomeProps | null;
  planType?: 'standard' | 'mood' | 'group';
  escrowPattern?: EscrowPattern | null;
};

export function CancellationSummaryCard({
  outcome,
  planType = 'standard',
  escrowPattern = 'A',
}: Props) {
  const [rows, setRows] = useState(CANCELLATION_POLICY_TABLE_ROWS);
  const [noShowRows, setNoShowRows] = useState<typeof rows>([]);
  const [noShowOpen, setNoShowOpen] = useState(false);

  useEffect(() => {
    const pattern = escrowPattern ?? 'A';
    void fetchCancellationMatrixRows({
      planType,
      escrowPattern: pattern,
      cancellingParty: planType === 'group' ? 'host' : pattern === 'B' ? 'either' : 'host',
    }).then((loaded) => {
      if (loaded.length) setRows(loaded);
    });
    void fetchNoShowMatrixRows({
      planType,
      escrowPattern: pattern,
      cancellingParty: planType === 'group' ? 'host' : pattern === 'B' ? 'either' : 'host',
    }).then(setNoShowRows);
  }, [planType, escrowPattern]);

  return (
    <section className="linkup-card space-y-4 p-5">
      <div>
        <h3 className="font-display text-lg font-extrabold text-foreground">Cancellation policy</h3>
        <p className="mt-2 text-[14px] font-semibold leading-relaxed text-muted">
          LinkUp applies role and timing based rules on the server so outcomes stay fair and predictable.
        </p>
      </div>
      <CancellationPolicyRows rows={rows} dense />
      {noShowRows.length ? (
        <div className="rounded-xl border border-border/60 bg-[#F5F6FA]">
          <button
            type="button"
            onClick={() => setNoShowOpen((o) => !o)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-[14px] font-extrabold text-foreground"
          >
            No-show consequences
            {noShowOpen ? <IoChevronUp size={18} /> : <IoChevronDown size={18} />}
          </button>
          {noShowOpen ? (
            <div className="border-t border-border/60 px-4 pb-4 pt-3">
              <CancellationPolicyRows rows={noShowRows} dense />
            </div>
          ) : null}
        </div>
      ) : null}
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
