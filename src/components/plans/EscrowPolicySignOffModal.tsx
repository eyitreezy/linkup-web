'use client';

/**
 * POLICY DELIVERY MOMENTS - GROUP PLANS (ANNEXURE B)
 *
 * 1. ONBOARDING (existing)
 *    Terms of Use - nature of platform, eligibility, escrow, contact policy
 *    Privacy and NDPR Consent - data collection, storage, user rights
 *
 * 2. FIRST GROUP PLAN INTERACTION (new - GroupPlanPolicyGate)
 *    Full Group Plan rules: confirmation window, Exigency process,
 *    all 5 outcomes, 50% floor, fund storage limit, host cancellation,
 *    host no-show, platform fee
 *    Signed once per policy version. Re-triggered on material policy update.
 *
 * 3. ESCROW INITIATION - BEFORE CHECKOUT (new - EscrowPolicySignOffModal)
 *    Per-pattern cancellation matrix, no-show consequences, 50% floor,
 *    platform fee. Signed once per plan per user.
 *
 * 4. FIRST MEETUP BETWEEN TWO PARTIES - AFTER ESCROW CONFIRMED (new - SafetyCaveatInterstitial)
 *    Safety recommendation: public space for first meetup.
 *    Acknowledged once per pair.
 *
 * 5. MEETUP TIME - AT SCHEDULED TIME (new - T+0 push notification)
 *    Reminder of Exigency Report window and auto-trigger consequence.
 *
 * 6. T+12H POST MEETUP (new - pg_cron push notification)
 *    Explicit 24-hour window reminder with Exigency Report link.
 *
 * 7. T+23H POST MEETUP (new - pg_cron push notification)
 *    Final warning: 1 hour left, auto-trigger consequence stated.
 *
 * 8. DISPUTE VIDEO CAPTURE (new - VideoEvidenceCapture NDPR consent)
 *    NDPR consent for video recording, storage, and identity association.
 *
 * 9. EXIGENCY EVIDENCE UPLOAD (new - ExigencyReportForm step 3)
 *    NDPR consent for medical/personal document processing.
 */

import {
  ESCROW_POLICY_BY_PATTERN,
  normalizeEscrowPattern,
} from '@/lib/groupPlan/policySignOffContent';
import { signEscrowPolicy } from '@/lib/groupPlan/annexureB';
import { cn } from '@/utils/cn';
import { useRef, useState } from 'react';

type Props = {
  planId: string;
  escrowPattern?: string | null;
  onSigned: () => void;
};

export function EscrowPolicySignOffModal({ planId, escrowPattern, onSigned }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pattern = normalizeEscrowPattern(escrowPattern);
  const sections = ESCROW_POLICY_BY_PATTERN[pattern];

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
      setHasScrolled(true);
    }
  }

  async function handleSign() {
    if (!hasScrolled || busy) return;
    setBusy(true);
    setError(null);
    const result = await signEscrowPolicy(planId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not save agreement');
      return;
    }
    onSigned();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="linkup-card flex max-h-[85vh] w-full max-w-lg flex-col p-5 shadow-xl">
        <h2 className="font-display text-xl font-extrabold text-foreground">
          Escrow and Cancellation Policy
        </h2>
        <p className="mt-1 text-[12px] font-extrabold uppercase tracking-wide text-primary">
          Pattern {pattern}
        </p>

        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1"
        >
          {sections.map((section) => (
            <section key={section.heading} className="space-y-2">
              <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-foreground">
                {section.heading}
              </h3>
              {section.paragraphs.map((p) => (
                <p key={p} className="text-[13px] font-semibold leading-relaxed text-muted">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>

        <p className="mt-4 text-[13px] font-semibold text-muted">
          By proceeding you confirm you have read and understood the escrow terms and cancellation
          policy that apply to this plan.
        </p>
        {error ? <p className="mt-2 text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}
        {!hasScrolled ? (
          <p className="mt-2 text-center text-[12px] font-extrabold text-secondary">
            Scroll to read before agreeing
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void handleSign()}
          disabled={busy || !hasScrolled}
          className={cn(
            'mt-3 flex min-h-[44px] w-full items-center justify-center rounded-full linkup-gradient-primary px-5 text-[14px] font-extrabold text-white transition hover:opacity-95 disabled:opacity-50'
          )}
        >
          {busy ? 'Confirming…' : 'I have read and I agree'}
        </button>
      </div>
    </div>
  );
}
