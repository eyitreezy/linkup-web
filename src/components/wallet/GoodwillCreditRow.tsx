import { TierBadge } from '@/components/subscription/TierBadge';
import { formatNGN } from '@/lib/escrow/escrowFormatters';
import { GOODWILL_TIER_MULTIPLIER } from '@/lib/plans/cancellationPolicy';
import type { SubscriptionTier } from '@/lib/subscription/types';
import type { DbGoodwillCredit } from '@/types/database';
import { cn } from '@/utils/cn';

const SOURCE_LABELS: Record<string, string> = {
  cancellation: 'Cancellation goodwill',
  dispute_resolution: 'Dispute resolution',
  promo: 'Promotional credit',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function GoodwillCreditRow({ credit }: { credit: DbGoodwillCredit }) {
  const remaining = credit.amount - credit.used_amount;
  const isExpired = new Date(credit.expires_at) < new Date();
  const isFullyUsed = credit.used_amount >= credit.amount;
  const tier = credit.tier_at_award as SubscriptionTier | null;
  const showTier =
    tier && tier !== 'FREE' && tier !== 'SILVER' && (tier === 'GOLD' || tier === 'PLATINUM');

  return (
    <div className="flex items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <p className="text-[14px] font-extrabold text-foreground">
          {SOURCE_LABELS[credit.source] ?? 'Goodwill credit'}
        </p>
        <p className="mt-0.5 text-[12px] font-semibold text-muted">
          Issued {formatDate(credit.created_at)} · Expires {formatDate(credit.expires_at)}
        </p>
        {showTier ? (
          <div className="mt-1.5 flex items-center gap-1.5">
            <TierBadge tier={tier} size="sm" />
            <span className="text-[11px] font-semibold text-muted">
              {GOODWILL_TIER_MULTIPLIER[tier]}× fee offset
            </span>
          </div>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <p
          className={cn(
            'text-[14px] font-extrabold tabular-nums',
            isExpired || isFullyUsed ? 'text-muted' : 'text-foreground'
          )}
        >
          {formatNGN(remaining)}
        </p>
        {credit.used_amount > 0 ? (
          <p className="text-[11px] font-semibold text-muted">{formatNGN(credit.used_amount)} applied to fees</p>
        ) : null}
        {isExpired ? <p className="text-[11px] font-semibold text-[#EF4444]">Expired</p> : null}
      </div>
    </div>
  );
}
