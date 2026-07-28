'use client';

import { ChatLogConsentStep } from '@/components/disputes/ChatLogConsentStep';
import { VideoEvidenceCapture } from '@/components/disputes/VideoEvidenceCapture';
import { PlanFlowHeader } from '@/features/plans/PlanFlowHeader';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

type Props = {
  planId: string;
  planTitle: string;
  reportedUserId: string;
};

export function DisputeReportClient({ planId, planTitle, reportedUserId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportedFromQuery = searchParams.get('reported');
  const targetUserId = reportedFromQuery || reportedUserId;
  const [step, setStep] = useState<'video' | 'consent' | 'done'>('video');
  const [disputeId, setDisputeId] = useState<string | null>(null);

  if (!targetUserId) {
    return (
      <div className="linkup-card px-6 py-12 text-center">
        <p className="font-extrabold text-foreground">Missing dispute target</p>
        <Link href={`/plan/${planId}`} className="mt-3 inline-block font-extrabold text-primary underline">
          Back to plan
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-16">
      <PlanFlowHeader
        kicker="Report no-show"
        title={planTitle}
        backHref={`/plan/${planId}`}
        backLabel="Back to plan"
      />

      {step === 'done' && disputeId ? (
        <div className="linkup-card space-y-3 p-5">
          <h2 className="font-display text-lg font-extrabold text-foreground">Report submitted</h2>
          <p className="text-[14px] font-semibold text-muted">
            Your video evidence and chat log preference have been received. Our team will review your
            no-show report.
          </p>
          <Link
            href={`/dispute/${planId}/detail`}
            className="inline-block font-extrabold text-primary underline"
          >
            View dispute status
          </Link>
        </div>
      ) : step === 'consent' && disputeId ? (
        <ChatLogConsentStep
          disputeId={disputeId}
          onConsentSubmitted={() => {
            setStep('done');
            router.refresh();
          }}
        />
      ) : (
        <VideoEvidenceCapture
          planId={planId}
          reportedUserId={targetUserId}
          onVideoSubmitted={(id) => {
            setDisputeId(id);
            setStep('consent');
          }}
        />
      )}
    </div>
  );
}
