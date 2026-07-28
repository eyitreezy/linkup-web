'use client';

import { CreatePlanLink } from '@/components/navigation/CreatePlanLink';
import type { ChatAppearancePreset } from '@/lib/messaging/chatAppearance';
import { cn } from '@/utils/cn';
import {
  IoCalendarOutline,
  IoFlashOutline,
  IoImageOutline,
  IoLocationOutline,
  IoShareOutline,
} from 'react-icons/io5';

type Props = {
  preset: ChatAppearancePreset;
  onOffer: () => void;
  onPlace: () => void;
  placeBusy?: boolean;
  onAttach?: () => void;
  onLiveLocation?: () => void;
  liveLocationActive?: boolean;
  liveLocationBusy?: boolean;
  showLiveLocation?: boolean;
  /** Mobile drawer: icon-only row above the composer. */
  variant?: 'default' | 'compact';
  className?: string;
};

function iconCircleClass(active?: boolean) {
  return cn(
    'flex h-8 w-8 items-center justify-center rounded-full shadow-sm ring-1 min-[360px]:h-9 min-[360px]:w-9 min-[400px]:h-9 min-[400px]:w-9',
    active
      ? 'bg-emerald-50 ring-emerald-500/30'
      : 'bg-white/90 ring-black/5'
  );
}

export function ChatToolbar({
  preset,
  onOffer,
  onPlace,
  placeBusy,
  onAttach,
  onLiveLocation,
  liveLocationActive,
  liveLocationBusy,
  showLiveLocation,
  variant = 'default',
  className,
}: Props) {
  const iconStyle = { color: preset.composerAttachIcon };
  const compact = variant === 'compact';

  const liveLocationLabel = liveLocationBusy
    ? '…'
    : liveLocationActive
      ? 'Sharing'
      : 'Live location';

  const liveLocationButton = showLiveLocation && onLiveLocation ? (
    <button
      type="button"
      disabled={liveLocationBusy}
      onClick={onLiveLocation}
      className={cn(
        compact
          ? 'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1 transition active:scale-95 hover:bg-black/5 disabled:opacity-50'
          : 'flex shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition hover:bg-black/5 disabled:opacity-50 min-[360px]:px-3'
      )}
      aria-label={liveLocationActive ? 'Stop sharing live location' : 'Share live location'}
    >
      <span className={iconCircleClass(liveLocationActive)}>
        {compact ? (
          <IoShareOutline size={18} style={iconStyle} />
        ) : (
          <>
            <IoShareOutline size={18} style={iconStyle} className="min-[400px]:hidden" />
            <IoShareOutline size={20} style={iconStyle} className="hidden min-[400px]:block" />
          </>
        )}
      </span>
      <span
        className={cn(
          'text-center font-extrabold leading-tight text-muted',
          compact ? 'max-w-[52px] text-[8px] min-[360px]:max-w-none min-[360px]:text-[10px]' : 'text-[10px] min-[360px]:text-[11px]'
        )}
      >
        {liveLocationLabel}
      </span>
    </button>
  ) : null;

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center justify-around gap-1 px-2 py-2 min-[360px]:gap-2 min-[360px]:px-3',
          className
        )}
        role="toolbar"
        aria-label="Chat actions"
      >
        <CreatePlanLink
          className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1 transition active:scale-95 hover:bg-black/5"
          aria-label="Suggest a plan"
        >
          <span className={iconCircleClass()}>
            <IoCalendarOutline size={18} style={iconStyle} />
          </span>
          <span className="text-[9px] font-extrabold text-muted min-[360px]:text-[10px]">Plan</span>
        </CreatePlanLink>
        <button
          type="button"
          onClick={onOffer}
          className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1 transition active:scale-95 hover:bg-black/5"
          aria-label="Send or open offer"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-secondary/15 shadow-sm ring-1 ring-primary/10 min-[360px]:h-9 min-[360px]:w-9">
            <IoFlashOutline size={18} style={iconStyle} />
          </span>
          <span className="text-[9px] font-extrabold text-muted min-[360px]:text-[10px]">Offer</span>
        </button>
        <button
          type="button"
          disabled={placeBusy}
          onClick={onPlace}
          className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1 transition active:scale-95 hover:bg-black/5 disabled:opacity-50"
          aria-label="Share meeting area"
        >
          <span className={iconCircleClass()}>
            <IoLocationOutline size={18} style={iconStyle} />
          </span>
          <span className="text-[9px] font-extrabold text-muted min-[360px]:text-[10px]">
            {placeBusy ? '…' : 'Place'}
          </span>
        </button>
        {liveLocationButton}
        {onAttach ? (
          <button
            type="button"
            onClick={onAttach}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1 transition active:scale-95 hover:bg-black/5"
            aria-label="Attach photo or video"
          >
            <span className={iconCircleClass()}>
              <IoImageOutline size={18} style={iconStyle} />
            </span>
            <span className="text-[9px] font-extrabold text-muted min-[360px]:text-[10px]">Media</span>
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn('flex gap-1 overflow-x-auto px-2.5 pb-2 scrollbar-none min-[360px]:px-3', className)}>
      <CreatePlanLink
        className="flex shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition hover:bg-black/5 min-[360px]:px-3"
        aria-label="Suggest a plan"
      >
        <span className={iconCircleClass()}>
          <IoCalendarOutline size={18} style={iconStyle} className="min-[400px]:hidden" />
          <IoCalendarOutline size={20} style={iconStyle} className="hidden min-[400px]:block" />
        </span>
        <span className="text-[10px] font-extrabold text-muted min-[360px]:text-[11px]">Plan</span>
      </CreatePlanLink>
      <button
        type="button"
        onClick={onOffer}
        className="flex shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition hover:bg-black/5 min-[360px]:px-3"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-secondary/15 shadow-sm ring-1 ring-primary/10 min-[400px]:h-9 min-[400px]:w-9">
          <IoFlashOutline size={18} style={iconStyle} className="min-[400px]:hidden" />
          <IoFlashOutline size={20} style={iconStyle} className="hidden min-[400px]:block" />
        </span>
        <span className="text-[10px] font-extrabold text-muted min-[360px]:text-[11px]">Offer</span>
      </button>
      <button
        type="button"
        disabled={placeBusy}
        onClick={onPlace}
        className="flex shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition hover:bg-black/5 disabled:opacity-50 min-[360px]:px-3"
      >
        <span className={iconCircleClass()}>
          <IoLocationOutline size={18} style={iconStyle} className="min-[400px]:hidden" />
          <IoLocationOutline size={20} style={iconStyle} className="hidden min-[400px]:block" />
        </span>
        <span className="text-[10px] font-extrabold text-muted min-[360px]:text-[11px]">{placeBusy ? '…' : 'Place'}</span>
      </button>
      {liveLocationButton}
    </div>
  );
}
