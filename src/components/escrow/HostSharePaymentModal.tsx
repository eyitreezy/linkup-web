'use client';

import { EscrowModalShell } from '@/components/escrow/EscrowModalShell';
import { EscrowNoticeBanner } from '@/components/escrow/EscrowNoticeBanner';
import { IoCheckmarkCircle, IoShieldCheckmark, IoTimeOutline, IoWalletOutline } from 'react-icons/io5';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  busy?: boolean;
  hostShareAmount: string;
  hostShareAmountCents: number;
  guestShareAmount: string;
  guestName: string;
  guestShareFunded: boolean;
  hostContributionBps?: number;
  isMoodPlan?: boolean;
  isGroupSplit?: boolean;
  isHost?: boolean;
};

function contributionSplitLabel(bps: number): string {
  const hostPct = Math.round(bps / 100);
  const guestPct = 100 - hostPct;
  return `${hostPct}% host / ${guestPct}% guest`;
}

export function HostSharePaymentModal({
  open,
  onClose,
  onConfirm,
  busy,
  hostShareAmount,
  hostShareAmountCents,
  guestShareAmount,
  guestName,
  guestShareFunded,
  hostContributionBps = 5000,
  isMoodPlan,
  isGroupSplit,
  isHost,
}: Props) {
  const splitLabel = contributionSplitLabel(hostContributionBps);
  const canProceedToPayment = hostShareAmountCents > 0;

  return (
    <EscrowModalShell open={open} onClose={onClose} maxWidth="md">
      <div className="flex items-start gap-3 pr-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <IoWalletOutline size={24} />
        </span>
        <div>
          {isGroupSplit ? (
            <>
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">
                Group plan · Split escrow
              </p>
              <h2 className="font-display text-xl font-extrabold text-foreground">
                {isHost
                  ? 'Pay your host share to activate the plan'
                  : 'Fund your negotiated share to confirm your slot'}
              </h2>
              <p className="mt-1 text-[14px] font-semibold text-muted">
                {isHost
                  ? 'Your share was calculated from the plan total after all guests committed their amounts. The plan activates once all guests and your share are funded.'
                  : 'Your share is the amount you and the host agreed during negotiation. Once you fund it, your slot is secured. The plan activates after all shares are funded.'}
              </p>
            </>
          ) : (
            <>
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">Host payment</p>
              <h2 className="font-display text-xl font-extrabold text-foreground">Pay your host share</h2>
              <p className="mt-1 text-[14px] font-semibold text-muted">
                You are funding your portion of this plan under the agreed contribution split ({splitLabel}).
              </p>
            </>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-primary/15 bg-[#EDE8FF]/40 px-4 py-4 text-center">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">
          {isGroupSplit ? (isHost ? 'Your host share' : 'Your agreed share') : 'Your host share'}
        </p>
        <p className="mt-1 font-display text-3xl font-extrabold text-primary">{hostShareAmount}</p>
        {isGroupSplit && !isHost ? (
          <p className="mt-1 text-[12px] font-semibold text-muted">Negotiated and agreed with the host.</p>
        ) : null}
      </div>

      <ul className="mt-5 space-y-3 text-[14px] font-semibold leading-relaxed text-muted">
        <li className="flex gap-2">
          <IoShieldCheckmark className="mt-0.5 shrink-0 text-primary" size={18} />
          <span>Your payment is held securely in LinkUp escrow until the meetup is confirmed.</span>
        </li>
        {!isGroupSplit ? (
          <li className="flex gap-2">
            <IoCheckmarkCircle className="mt-0.5 shrink-0 text-primary" size={18} />
            <span>
              {guestShareFunded
                ? `${guestName} has already funded their guest share (${guestShareAmount}).`
                : `${guestName} must also fund their guest share (${guestShareAmount}) before the plan goes active.`}
            </span>
          </li>
        ) : null}
        <li className="flex gap-2">
          <IoWalletOutline className="mt-0.5 shrink-0 text-primary" size={18} />
          <span>Checkout opens in Flutterwave. You will return here when payment completes.</span>
        </li>
      </ul>

      <div className="mt-4 space-y-3">
        {isGroupSplit ? (
          <EscrowNoticeBanner
            tone="info"
            icon={<IoShieldCheckmark className="text-primary" size={18} />}
            title="Group split escrow"
          >
            {isHost ? (
              <>
                The plan activates once all guests have funded their individual shares and your share is received.
                Funds are released according to the plan rules after the meetup is confirmed.
              </>
            ) : (
              <>
                The plan activates once all guests and the host have funded their shares. Funds are released
                according to the plan rules after the meetup is confirmed.
              </>
            )}
          </EscrowNoticeBanner>
        ) : (
          <EscrowNoticeBanner
            tone="info"
            icon={<IoShieldCheckmark className="text-primary" size={18} />}
            title="Split escrow"
          >
            The plan goes active only after both the host share and guest share are funded. Funds are released
            according to plan rules after the meetup is confirmed.
          </EscrowNoticeBanner>
        )}
        {isMoodPlan && !isGroupSplit ? (
          <EscrowNoticeBanner tone="warning" icon={<IoTimeOutline size={20} />} title="Mood plan funding">
            Mood plans have a shorter funding window. Complete your payment promptly so the meetup can go ahead.
          </EscrowNoticeBanner>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 min-[360px]:flex-row min-[360px]:justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="min-h-[44px] rounded-full border border-border px-5 text-[14px] font-extrabold text-muted disabled:opacity-50"
        >
          Cancel
        </button>
        {canProceedToPayment ? (
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="min-h-[44px] rounded-full linkup-gradient-primary px-5 text-[14px] font-extrabold text-white disabled:opacity-50"
          >
            {busy ? 'Opening checkout…' : `Continue to payment · ${hostShareAmount}`}
          </button>
        ) : null}
      </div>
    </EscrowModalShell>
  );
}
