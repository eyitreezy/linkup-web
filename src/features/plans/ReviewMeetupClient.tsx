'use client';

import { PlanFlowHeader } from '@/features/plans/PlanFlowHeader';
import { StarPicker } from '@/components/reviews/StarPicker';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Props = {
  planId: string;
  planTitle: string;
};

export function ReviewMeetupClient({ planId, planTitle }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [isHost, setIsHost] = useState(false);
  const [revieweeName, setRevieweeName] = useState('');
  const [scores, setScores] = useState({ punctuality: 0, conduct: 0, plan_quality: 0 });
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push(`/login?next=${encodeURIComponent(`/plan/${planId}/review`)}`);
        return;
      }

      const { data: plan } = await supabase
        .from('plans')
        .select('creator_id, review_unlock_at, title')
        .eq('id', planId)
        .single();

      if (!plan?.review_unlock_at) {
        router.push(`/plan/${planId}`);
        return;
      }

      const userIsHost = plan.creator_id === user.id;
      setIsHost(userIsHost);

      const { data: existing } = await supabase
        .from('meetup_reviews')
        .select('score_punctuality')
        .eq('plan_id', planId)
        .eq('reviewer_id', user.id)
        .maybeSingle();

      if (existing?.score_punctuality && existing.score_punctuality > 0) {
        setAlreadySubmitted(true);
        setIsLoading(false);
        return;
      }

      if (userIsHost) {
        const { data: offer } = await supabase
          .from('plan_offers')
          .select('bidder_id')
          .eq('plan_id', planId)
          .eq('status', 'accepted')
          .limit(1)
          .maybeSingle();
        if (offer?.bidder_id) {
          const { data: guestProfile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', offer.bidder_id)
            .maybeSingle();
          setRevieweeName(guestProfile?.display_name?.split(' ')[0] ?? 'your guest');
        }
      } else {
        const { data: hostProfile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', plan.creator_id)
          .maybeSingle();
        setRevieweeName(hostProfile?.display_name?.split(' ')[0] ?? 'your host');
      }

      setIsLoading(false);
    };
    void load();
  }, [planId, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (scores.punctuality === 0 || scores.conduct === 0) {
      setError('Please rate both punctuality and conduct before submitting.');
      return;
    }
    if (!isHost && scores.plan_quality === 0) {
      setError('Please rate plan quality before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: rpcError } = await supabase.rpc('submit_review', {
        p_plan_id: planId,
        p_score_punctuality: scores.punctuality,
        p_score_conduct: scores.conduct,
        p_score_plan_quality: !isHost ? scores.plan_quality : null,
        p_review_text: reviewText.trim() || null,
      });

      if (rpcError) throw rpcError;
      router.push(`/plan/${planId}?reviewed=1`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg pb-16">
        <div className="h-32 animate-pulse rounded-2xl bg-[#EDE8FF]/70" />
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="mx-auto max-w-lg space-y-4 pb-16">
        <PlanFlowHeader
          kicker="Review"
          title={planTitle}
          backHref={`/plan/${planId}`}
          backLabel="Back to plan"
        />
        <div className="linkup-card p-5">
          <p className="text-[14px] font-semibold text-foreground">
            You have already submitted your review for this meetup.
          </p>
          <Link
            href={`/plan/${planId}`}
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full border border-border px-5 text-[14px] font-extrabold text-muted"
          >
            Back to plan
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-16">
      <PlanFlowHeader
        kicker="Review"
        title={`How was your meetup with ${revieweeName}?`}
        backHref={`/plan/${planId}`}
        backLabel="Back to plan"
      />

      <p className="text-[14px] font-semibold leading-relaxed text-muted">
        Your review is private until both parties have submitted, or 7 days have passed.
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="linkup-card space-y-6 p-5">
        <StarPicker
          label="Punctuality"
          hint="Did they arrive on time and communicate any delays?"
          value={scores.punctuality}
          onChange={(v) => setScores((s) => ({ ...s, punctuality: v }))}
        />

        <StarPicker
          label="Respect and conduct"
          hint="Were they courteous and as described on their profile?"
          value={scores.conduct}
          onChange={(v) => setScores((s) => ({ ...s, conduct: v }))}
        />

        {!isHost ? (
          <StarPicker
            label="Plan quality"
            hint="Did the meetup match what was described in the plan?"
            value={scores.plan_quality}
            onChange={(v) => setScores((s) => ({ ...s, plan_quality: v }))}
          />
        ) : null}

        <div>
          <label className="text-[13px] font-extrabold text-foreground">
            Written review <span className="font-semibold text-muted">(optional)</span>
          </label>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Share what made this meetup memorable, or what could have been better."
            maxLength={500}
            rows={4}
            className="mt-2 w-full rounded-xl border border-border px-3 py-2.5 text-[14px] font-semibold"
          />
          <p className="mt-1 text-right text-[11px] font-semibold text-muted">{reviewText.length}/500</p>
        </div>

        {error ? <p className="text-[13px] font-semibold text-[#EF4444]">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            'flex min-h-[48px] w-full items-center justify-center rounded-full linkup-gradient-primary text-[15px] font-extrabold text-white shadow-md disabled:opacity-50'
          )}
        >
          {isSubmitting ? 'Submitting…' : 'Submit review'}
        </button>

        <p className="text-center text-[11px] font-semibold text-muted">
          You can edit your review within 24 hours. After that it is permanently locked.
        </p>
      </form>
    </div>
  );
}
