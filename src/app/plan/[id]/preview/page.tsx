import { APP_NAME } from '@/lib/brand';
import {
  fetchPlanSharePreview,
  planShareCity,
  planShareHostFirstName,
  planSharePreviewUrl,
  planSharePriceLabel,
} from '@/lib/plans/planSharePreview';
import { resolveMeetTypeCoverUrl } from '@/lib/plans/resolveMeetTypeCoverUrl';
import { env, isSupabaseConfigured } from '@/lib/env';
import { createPublicClient } from '@/lib/supabase/public';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!isSupabaseConfigured) {
    return { title: `${APP_NAME} — Verified Meetups` };
  }

  const supabase = createPublicClient();
  const { data: plan } = await fetchPlanSharePreview(supabase, id);

  if (!plan) {
    return { title: `${APP_NAME} — Verified Meetups` };
  }

  const city = planShareCity(plan.location_label);
  const meetType = plan.meet_types?.name ?? 'Meetup';
  const title = `${meetType} in ${city} — ${APP_NAME}`;
  const description = `Join a verified ${meetType.toLowerCase()} meetup on ${APP_NAME}.`;
  const previewUrl = planSharePreviewUrl(id, env.appUrl);
  const cardUrl = `${env.appUrl}/api/plan/${id}/card`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [cardUrl],
      url: previewUrl,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [cardUrl],
    },
  };
}

export default async function PlanPreviewPage({ params }: Props) {
  const { id } = await params;

  if (!isSupabaseConfigured) {
    return (
      <p className="p-6 text-center text-[14px] font-semibold text-muted">
        Configure Supabase env vars to load this preview.
      </p>
    );
  }

  const supabase = createPublicClient();
  const { data: plan } = await fetchPlanSharePreview(supabase, id);

  if (!plan) notFound();

  const city = planShareCity(plan.location_label);
  const meetTypeName = plan.meet_types?.name ?? 'Meetup';
  const meetDate = plan.scheduled_at
    ? new Date(plan.scheduled_at).toLocaleDateString('en-NG', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;
  const slotsLeft =
    plan.max_guests != null ? plan.max_guests - (plan.accepted_guest_count ?? 0) : null;
  const priceDisplay = planSharePriceLabel(plan);
  const coverUrl =
    plan.meet_types != null ? resolveMeetTypeCoverUrl(plan.meet_types) : null;
  const displayTitle = plan.title?.trim() || `${meetTypeName} in ${city}`;
  const signupHref = `/signup?next=${encodeURIComponent(`/plan/${plan.id}`)}`;
  const loginHref = `/login?next=${encodeURIComponent(`/plan/${plan.id}`)}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary to-secondary p-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        {coverUrl ? (
          <div className="relative h-48 w-full">
            <Image src={coverUrl} alt={meetTypeName} fill className="object-cover" sizes="448px" />
          </div>
        ) : (
          <div className="flex h-48 w-full items-center justify-center bg-gradient-to-br from-primary to-secondary">
            <span className="text-4xl font-extrabold text-white">{meetTypeName[0] ?? 'L'}</span>
          </div>
        )}

        <div className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <span className="text-lg font-extrabold text-primary">{APP_NAME}</span>
            <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-semibold text-primary">
              Verified Meetup
            </span>
          </div>

          <p className="text-sm font-semibold text-muted">{meetTypeName}</p>

          <h1 className="text-2xl font-extrabold leading-tight text-foreground">{displayTitle}</h1>

          <div className="space-y-2">
            {meetDate ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <span aria-hidden>📅</span>
                <span className="font-semibold text-foreground">{meetDate}</span>
              </div>
            ) : null}
            <div className="flex items-center gap-2 text-sm text-muted">
              <span aria-hidden>📍</span>
              <span className="font-semibold text-foreground">{city}</span>
            </div>
            {priceDisplay ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <span aria-hidden>💰</span>
                <span>{priceDisplay}</span>
              </div>
            ) : null}
            {slotsLeft != null && slotsLeft > 0 ? (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                {slotsLeft} {slotsLeft === 1 ? 'slot' : 'slots'} remaining
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 pt-1 text-sm text-muted">
            <span>Hosted by</span>
            <span className="font-semibold text-foreground">
              {planShareHostFirstName(plan.creator?.display_name)}
            </span>
            <span className="text-xs font-semibold text-primary">Verified</span>
          </div>

          <p className="text-xs italic text-muted">
            Sign up to see full details, the exact location, and to join this meetup.
          </p>

          <Link
            href={signupHref}
            className="block w-full rounded-full py-4 text-center text-base font-extrabold text-white linkup-gradient-primary transition hover:opacity-95"
          >
            Join this meetup on {APP_NAME}
          </Link>

          <p className="text-center text-sm text-muted">
            Already on {APP_NAME}?{' '}
            <Link href={loginHref} className="font-semibold text-primary hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
