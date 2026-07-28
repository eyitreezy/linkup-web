'use client';

import { GROUP_PLAN_POLICY_SECTIONS } from '@/lib/groupPlan/policySignOffContent';
import { signGroupPolicySignoff } from '@/lib/groupPlan/annexureB';
import { cn } from '@/utils/cn';
import { useRef, useState } from 'react';

type ModalProps = {
  onSigned: () => void;
};

export function GroupPlanPolicyModal({ onSigned }: ModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    const result = await signGroupPolicySignoff();
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not save agreement');
      return;
    }
    onSigned();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="linkup-card flex max-h-[85vh] w-full max-w-lg flex-col p-5">
        <h2 className="font-display text-xl font-extrabold text-foreground">
          Before you join or create a Group Plan
        </h2>
        <p className="mt-1 text-[13px] font-semibold text-muted">Group Plan Rules</p>

        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1"
        >
          {GROUP_PLAN_POLICY_SECTIONS.map((section) => (
            <section key={section.heading} className="space-y-2">
              <h4 className="text-[13px] font-extrabold uppercase tracking-wide text-foreground">
                {section.heading}
              </h4>
              {section.paragraphs.map((p) => (
                <p key={p} className="text-[13px] font-semibold leading-relaxed text-muted">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>

        {error ? <p className="mt-3 text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}
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
          {busy ? 'Saving…' : 'I have read and I agree'}
        </button>
      </div>
    </div>
  );
}
