'use client';

import { PlanShareCardPreview } from '@/components/plans/PlanShareCardPreview';
import { APP_NAME } from '@/lib/brand';
import { planSharePreviewUrl } from '@/lib/plans/planSharePreview';
import { createClient } from '@/lib/supabase/client';
import { env } from '@/lib/env';
import { cn } from '@/utils/cn';
import { useState } from 'react';

export type PlanShareChannel = 'whatsapp' | 'copy_link' | 'native' | 'twitter' | 'instagram';

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

          <button
            type="button"
            onClick={() => void handleCopyLink()}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-primary/25 bg-white py-2.5 text-sm font-extrabold text-primary transition hover:bg-[#EDE8FF]/50"
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>

          <button
            type="button"
            onClick={() => void handleTwitter()}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-primary/25 bg-white py-2.5 text-sm font-extrabold text-primary transition hover:bg-[#EDE8FF]/50"
          >
            Share on X
          </button>

          {canNativeShare ? (
            <button
              type="button"
              onClick={() => void handleNativeShare()}
              className={cn(
                'col-span-2 py-1 text-center text-sm font-semibold text-muted transition hover:text-foreground'
              )}
            >
              More sharing options
            </button>
          ) : null}
        </div>

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
