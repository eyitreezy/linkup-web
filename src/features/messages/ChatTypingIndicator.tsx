'use client';

import { cn } from '@/utils/cn';

type Props = {
  visible: boolean;
  peerName?: string;
};

export function ChatTypingIndicator({ visible, peerName }: Props) {
  if (!visible) return null;

  return (
    <div
      className="flex items-center gap-2 px-2.5 pb-2 min-[360px]:px-4"
      role="status"
      aria-live="polite"
      aria-label="Typing"
    >
      <div className="flex items-center gap-1.5 rounded-[20px] border border-primary/15 bg-white/95 px-3 py-2.5 shadow-sm">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:120ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:240ms]" />
      </div>
      <span className="truncate text-[12px] font-semibold text-muted min-[360px]:text-[13px]">
        {peerName ? `${peerName} is typing…` : 'Typing…'}
      </span>
    </div>
  );
}
