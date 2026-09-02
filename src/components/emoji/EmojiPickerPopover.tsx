'use client';

import { EMOJI_PICKER_GROUPS } from '@/lib/emoji/emojiPicker';
import { cn } from '@/utils/cn';
import { useEffect, useRef } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  className?: string;
  placement?: 'above' | 'below';
};

export function EmojiPickerPopover({
  open,
  onClose,
  onSelect,
  className,
  placement = 'above',
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className={cn(
        'absolute z-[60] w-[min(320px,calc(100vw-1.5rem))] rounded-2xl border border-border bg-white p-3 shadow-xl',
        placement === 'above' ? 'bottom-full mb-2' : 'top-full mt-2',
        className
      )}
      role="listbox"
      aria-label="Emoji picker"
    >
      <div className="max-h-[240px] space-y-3 overflow-y-auto overscroll-contain">
        {EMOJI_PICKER_GROUPS.map((group) => (
          <section key={group.label}>
            <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-muted">
              {group.label}
            </p>
            <div className="grid grid-cols-8 gap-0.5">
              {group.emojis.map((emoji) => (
                <button
                  key={`${group.label}-${emoji}`}
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[20px] transition hover:bg-[#EDE8FF]/70"
                  onClick={() => {
                    onSelect(emoji);
                    onClose();
                  }}
                  aria-label={`Insert ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
