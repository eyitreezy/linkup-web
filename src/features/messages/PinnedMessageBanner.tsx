'use client';

import type { ReplyQuotePreview } from '@/lib/messaging/chatReply';
import { IoClose, IoPin } from 'react-icons/io5';

type Props = {
  quote: ReplyQuotePreview;
  onPress: () => void;
  onUnpin: () => void;
};

export function PinnedMessageBanner({ quote, onPress, onUnpin }: Props) {
  return (
    <div className="sticky top-0 z-20 mb-2">
      <button
        type="button"
        onClick={onPress}
        className="flex w-full items-center gap-2 rounded-xl border border-primary/20 bg-white/95 px-3 py-2 text-left shadow-sm backdrop-blur-sm transition hover:bg-[#EDE8FF]/40"
      >
        <IoPin className="shrink-0 text-primary" size={16} />
        <div className="min-w-0 flex-1 border-l-2 border-primary pl-2">
          <p className="text-[11px] font-extrabold text-primary">Pinned message</p>
          <p className="truncate text-[13px] font-semibold text-foreground">{quote.preview}</p>
        </div>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onUnpin();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onUnpin();
            }
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-[#F5F6FA]"
          aria-label="Unpin message"
        >
          <IoClose size={18} />
        </span>
      </button>
    </div>
  );
}
