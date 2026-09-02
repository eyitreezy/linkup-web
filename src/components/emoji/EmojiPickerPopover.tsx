'use client';

import { EMOJI_PICKER_GROUPS } from '@/lib/emoji/emojiPicker';
import { cn } from '@/utils/cn';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

const PANEL_WIDTH = 320;
const PANEL_ESTIMATED_HEIGHT = 280;
const VIEWPORT_MARGIN = 8;

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  anchorRef: RefObject<HTMLElement | null>;
  className?: string;
  placement?: 'above' | 'below' | 'auto';
};

function computePanelPosition(
  anchor: HTMLElement,
  panelWidth: number,
  panelHeight: number,
  preferred: 'above' | 'below' | 'auto'
): CSSProperties {
  const rect = anchor.getBoundingClientRect();
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  let left = rect.right - panelWidth;
  left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(left, viewportW - panelWidth - VIEWPORT_MARGIN)
  );

  const spaceAbove = rect.top - VIEWPORT_MARGIN;
  const spaceBelow = viewportH - rect.bottom - VIEWPORT_MARGIN;

  let openAbove =
    preferred === 'above'
      ? true
      : preferred === 'below'
        ? false
        : spaceAbove >= panelHeight || spaceAbove >= spaceBelow;

  if (openAbove && spaceAbove < panelHeight && spaceBelow > spaceAbove) {
    openAbove = false;
  }

  let top = openAbove ? rect.top - panelHeight - VIEWPORT_MARGIN : rect.bottom + VIEWPORT_MARGIN;
  top = Math.max(
    VIEWPORT_MARGIN,
    Math.min(top, viewportH - panelHeight - VIEWPORT_MARGIN)
  );

  return { top, left, width: panelWidth };
}

export function EmojiPickerPopover({
  open,
  onClose,
  onSelect,
  anchorRef,
  className,
  placement = 'auto',
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return;
    }

    function updatePosition() {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const panel = panelRef.current;
      const panelWidth = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
      const panelHeight = panel?.offsetHeight ?? PANEL_ESTIMATED_HEIGHT;

      setPanelStyle(computePanelPosition(anchor, panelWidth, panelHeight, placement));
    }

    updatePosition();
    const raf = requestAnimationFrame(updatePosition);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, anchorRef, placement]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, onClose, anchorRef]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      ref={panelRef}
      className={cn(
        'fixed z-[9999] rounded-2xl border border-border bg-white p-3 shadow-xl',
        !panelStyle && 'pointer-events-none invisible',
        className
      )}
      style={
        panelStyle ?? {
          top: VIEWPORT_MARGIN,
          left: VIEWPORT_MARGIN,
          width: PANEL_WIDTH,
        }
      }
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
    </div>,
    document.body
  );
}
