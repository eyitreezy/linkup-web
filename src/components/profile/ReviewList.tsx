'use client';

import { ReportReviewButton } from '@/components/reviews/ReportReviewButton';
import { StarRatingDisplay } from '@/components/reviews/HostRatingBadge';
import { computeHostReviewOverall } from '@/components/reviews/StarPicker';
import { planShareCity } from '@/lib/plans/planSharePreview';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

type ReviewRow = {
  id: string;
  score_punctuality: number;
  score_conduct: number;
  score_plan_quality: number | null;
  review_text: string | null;
  revealed_at: string | null;
  plans?: {
    location_label: string | null;
    meet_types?: { name: string } | { name: string }[] | null;
  } | {
    location_label: string | null;
    meet_types?: { name: string } | { name: string }[] | null;
  }[] | null;
  reviewer?: { display_name: string | null } | { display_name: string | null }[] | null;
};

export function ReviewList({ profileUserId }: { profileUserId: string }) {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const supabase = createClient();

  useEffect(() => {
    void supabase
      .from('meetup_reviews')
      .select(`
        id,
        score_punctuality,
        score_conduct,
        score_plan_quality,
        review_text,
        revealed_at,
        plans!inner ( location_label, meet_types ( name ) ),
        reviewer:profiles!reviewer_id ( display_name )
      `)
      .eq('reviewee_id', profileUserId)
      .eq('reviewer_role', 'guest')
      .eq('is_hidden', false)
      .eq('is_suppressed', false)
      .gt('score_punctuality', 0)
      .order('revealed_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setReviews((data ?? []) as ReviewRow[]));
  }, [profileUserId]);

  if (reviews.length === 0) return null;

  return (
    <div className="mt-4 space-y-3">
      {reviews.map((r) => {
        const plan = Array.isArray(r.plans) ? r.plans[0] : r.plans;
        const meetTypeRaw = plan?.meet_types;
        const meetType = Array.isArray(meetTypeRaw) ? meetTypeRaw[0] : meetTypeRaw;
        const reviewer = Array.isArray(r.reviewer) ? r.reviewer[0] : r.reviewer;
        const overall = computeHostReviewOverall(
          r.score_punctuality,
          r.score_conduct,
          r.score_plan_quality
        );

        return (
          <div key={r.id} className="linkup-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-[12px] font-extrabold text-primary">
                  {reviewer?.display_name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="text-[14px] font-extrabold text-foreground">
                    {reviewer?.display_name?.split(' ')[0] ?? 'A guest'}
                  </p>
                  <p className="text-[11px] font-semibold text-muted">
                    {meetType?.name ?? ''}
                    {plan?.location_label ? ` · ${planShareCity(plan.location_label)}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <StarRatingDisplay score={overall} className="text-sm" />
                <ReportReviewButton reviewId={r.id} />
              </div>
            </div>

            {r.review_text ? (
              <p className="mt-2 text-[14px] font-semibold leading-relaxed text-foreground">{r.review_text}</p>
            ) : null}

            {r.revealed_at ? (
              <p className="mt-1 text-[11px] font-semibold text-muted">
                {new Date(r.revealed_at).toLocaleDateString('en-NG', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
