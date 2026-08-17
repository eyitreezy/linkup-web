'use client';

import { PlanShareCardPreview } from '@/components/plans/PlanShareCardPreview';
import { APP_NAME } from '@/lib/brand';
import { planSharePreviewUrl } from '@/lib/plans/planSharePreview';
import { createClient } from '@/lib/supabase/client';
import { env } from '@/lib/env';
import { cn } from '@/utils/cn';
import { useState } from 'react';

export type PlanShareChannel =
  | 'whatsapp'
  | 'copy_link'
  | 'native'
  | 'twitter'
  | 'instagram'
  | 'facebook';

interface PlanShareModalProps {
  planId: string;
  planTitle: string;
  meetTypeName: string;
  city: string;
  meetDateLabel: string | null;
  priceLabel: string | null;
  hostDisplayName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId?: string | null;
}

const secondaryShareButtonClass =
  'flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-primary/25 bg-white py-2.5 text-sm font-extrabold text-primary transition hover:bg-[#EDE8FF]/50';

export function PlanShareModal({
  planId,
  planTitle,
  meetTypeName,
  city,
  meetDateLabel,
  priceLabel,
  hostDisplayName,
  open,
  onOpenChange,
  currentUserId,
}: PlanShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [instagramHint, setInstagramHint] = useState<string | null>(null);
  const previewUrl = planSharePreviewUrl(planId, env.appUrl);
  const shareText = `Join ${meetTypeName} in ${city} on ${APP_NAME}, a verified meetup platform`;
  const cardTitle = planTitle?.trim() || `${meetTypeName} in ${city}`;

  const recordShare = async (channel: PlanShareChannel) => {
    try {
      const supabase = createClient();
      await supabase.from('plan_shares').insert({
        plan_id: planId,
        shared_by_user_id: currentUserId ?? null,
        channel,
      });
    } catch {
      /* Non-critical */
    }
  };

  const handleWhatsApp = async () => {
    await recordShare('whatsapp');
    const waText = encodeURIComponent(`${shareText}\n\n${previewUrl}`);
    window.open(`https://wa.me/?text=${waText}`, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = async () => {
    await recordShare('copy_link');
    await navigator.clipboard.writeText(previewUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (!navigator.share) return;
    await recordShare('native');
    await navigator.share({
      title: planTitle?.trim() || `${meetTypeName} in ${city}`,
      text: shareText,
      url: previewUrl,
    });
  };

  const handleTwitter = async () => {
    await recordShare('twitter');
    const tweetText = encodeURIComponent(`${shareText} ${previewUrl}`);
    window.open(`https://twitter.com/intent/tweet?text=${tweetText}`, '_blank', 'noopener,noreferrer');
  };

  const handleFacebook = async () => {
    await recordShare('facebook');
    const shareUrl = encodeURIComponent(previewUrl);
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleInstagram = async () => {
    await recordShare('instagram');
    setInstagramHint(null);
    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${previewUrl}`);
      setInstagramHint(
        'Link copied. Open Instagram and paste it in a Story, post, or DM. Instagram does not support direct link sharing from the browser.'
      );
    } catch {
      setInstagramHint(
        'Instagram does not support direct link sharing from the browser. Use Copy link, then paste in Instagram.'
      );
    }
  };

  if (!open) return null;

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm min-[425px]:items-center min-[425px]:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-share-title"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="linkup-card flex w-full min-w-0 max-w-md flex-col rounded-2xl p-4 shadow-xl min-[425px]:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="plan-share-title" className="font-display text-lg font-extrabold text-foreground">
          Share this plan
        </h2>

        <div className="mt-3 overflow-hidden rounded-2xl border border-border/60">
          <PlanShareCardPreview
            meetTypeName={meetTypeName}
            title={cardTitle}
            city={city}
            meetDateLabel={meetDateLabel}
            priceLabel={priceLabel}
            hostDisplayName={hostDisplayName}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => void handleWhatsApp()}
            className="col-span-2 flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#25D366] py-3 text-sm font-extrabold text-white transition hover:opacity-95"
          >
            <WhatsAppIcon />
            Share on WhatsApp
          </button>

          <button type="button" onClick={() => void handleCopyLink()} className={secondaryShareButtonClass}>
            {copied ? 'Copied' : 'Copy link'}
          </button>

          <button type="button" onClick={() => void handleTwitter()} className={secondaryShareButtonClass}>
            Share on X
          </button>

          <button type="button" onClick={() => void handleFacebook()} className={secondaryShareButtonClass}>
            <FacebookIcon />
            Share on Facebook
          </button>

          <button type="button" onClick={() => void handleInstagram()} className={secondaryShareButtonClass}>
            <InstagramIcon />
            Share on Instagram
          </button>
        </div>

        {instagramHint ? (
          <p className="mt-3 rounded-xl border border-primary/15 bg-[#F8F7FF] px-3 py-2.5 text-[12px] font-semibold leading-relaxed text-muted">
            {instagramHint}
          </p>
        ) : null}

        {canNativeShare ? (
          <button
            type="button"
            onClick={() => void handleNativeShare()}
            className={cn(
              'mt-3 py-1 text-center text-sm font-semibold text-muted transition hover:text-foreground'
            )}
          >
            More sharing options
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-full border border-border px-4 text-[14px] font-extrabold text-muted transition hover:bg-[#EDE8FF]/50"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.528 5.845L0 24l6.341-1.502A11.935 11.935 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.652-.51-5.17-1.395l-.371-.219-3.767.892.948-3.667-.24-.389A9.939 9.939 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}
