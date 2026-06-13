'use client';

import { formatMessageTime } from '@/lib/messaging/formatMessageTime';
import type { ReplyQuotePreview } from '@/lib/messaging/chatReply';
import { messageDisplayText, parseLegacyImageBody } from '@/lib/messaging/messagePreview';
import type { ResolvedChatBubbleTheme } from '@/lib/messaging/chatAppearance';
import type { ChatMessageRow } from '@/services/messages.service';
import { cn } from '@/utils/cn';
import { IoCheckmark, IoCheckmarkDone } from 'react-icons/io5';
import type { CSSProperties, MouseEvent } from 'react';
import { useRef } from 'react';

export type ChatBubbleMeta = {
  timeLabel: string;
  showSent?: boolean;
  showRead?: boolean;
};

type Props = {
  message: ChatMessageRow;
  mine: boolean;
  theme?: ResolvedChatBubbleTheme | null;
  meta?: ChatBubbleMeta | null;
  compact?: boolean;
  quote?: ReplyQuotePreview | null;
  highlighted?: boolean;
  senderLabel?: string | null;
  isAdmin?: boolean;
  isSystem?: boolean;
  onOpenActions?: () => void;
  onQuotePress?: () => void;
  messageRef?: (el: HTMLDivElement | null) => void;
};

function bubbleGradient(colors: [string, string, string]): CSSProperties {
  return { background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]}, ${colors[2]})` };
}

export function ChatMessageBubble({
  message,
  mine,
  theme,
  meta,
  compact,
  quote,
  highlighted,
  senderLabel,
  isAdmin,
  isSystem,
  onOpenActions,
  onQuotePress,
  messageRef,
}: Props) {
  const text = messageDisplayText(message);
  const legacyImage = parseLegacyImageBody(message.body ?? message.text ?? null);
  const mediaUrl = message.mediaUrl ?? legacyImage;
  const isVideo = message.mediaKind === 'video';
  const t = theme;
  const timeLabel = meta?.timeLabel ?? formatMessageTime(message.created_at);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleContextMenu(e: MouseEvent) {
    if (!onOpenActions) return;
    e.preventDefault();
    onOpenActions();
  }

  function clearLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  if (isSystem) {
    return (
      <div ref={messageRef} className="flex justify-center py-1">
        <span className="rounded-full bg-[#F3F4F6] px-3 py-1 text-[12px] font-semibold text-muted">
          {text ?? 'System message'}
        </span>
      </div>
    );
  }

  if (message.deleted_at) {
    return (
      <div
        ref={messageRef}
        className={cn('flex', mine ? 'justify-end' : 'justify-start')}
        onContextMenu={handleContextMenu}
      >
        <span
          className={cn(
            'rounded-2xl bg-[#F3F4F6] italic text-muted',
            compact ? 'px-2.5 py-1.5 text-[12px]' : 'px-3 py-2 text-[13px]'
          )}
        >
          Message deleted
        </span>
      </div>
    );
  }

  const mineStyle = mine && t ? bubbleGradient(t.mineBubble) : undefined;
  const themStyle =
    !mine && t
      ? {
          background: `linear-gradient(135deg, ${t.themBubble.join(', ')})`,
          borderColor: t.themBubbleBorder,
          color: t.textThem,
        }
      : undefined;

  return (
    <div
      ref={messageRef}
      className={cn(
        'flex flex-col gap-0.5 transition',
        mine ? 'items-end' : 'items-start',
        highlighted && 'rounded-2xl ring-2 ring-amber-300/80'
      )}
      onContextMenu={handleContextMenu}
      onTouchStart={() => {
        if (!onOpenActions) return;
        clearLongPress();
        longPressTimer.current = setTimeout(() => onOpenActions(), 480);
      }}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
    >
      {!mine && senderLabel ? (
        <div className="mb-0.5 flex items-center gap-1 px-1">
          <span className="text-[12px] font-extrabold text-foreground">{senderLabel}</span>
          {isAdmin ? (
            <span className="rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-extrabold text-primary">
              Admin
            </span>
          ) : null}
        </div>
      ) : null}
      {mediaUrl ? (
        <div
          className={cn(
            'max-w-[min(280px,80%)] overflow-hidden rounded-2xl border',
            mine ? 'border-primary/20' : 'border-border'
          )}
        >
          {isVideo ? (
            <video src={mediaUrl} controls className="max-h-64 w-full bg-black object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="" className="max-h-64 w-full object-cover" />
          )}
        </div>
      ) : null}
      {text || quote ? (
        <span
          className={cn(
            'max-w-[88%] rounded-2xl font-semibold min-[360px]:max-w-[85%] lg:max-w-[80%]',
            compact ? 'px-3 py-2 text-[14px] leading-snug' : 'px-4 py-2.5',
            !t && !compact && 'text-[15px]',
            !t && mine && 'linkup-gradient-primary text-white',
            !t && !mine && 'border border-border bg-surface text-foreground'
          )}
          style={{
            ...(mine ? mineStyle : themStyle),
            fontSize: t?.fontSize,
            fontWeight: t?.fontWeight,
            color: mine && t ? t.textMine : !mine && t ? t.textThem : undefined,
          }}
        >
          {quote ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuotePress?.();
              }}
              className={cn(
                'mb-2 block w-full rounded-lg border-l-2 py-1 pl-2 text-left text-[12px] font-semibold',
                mine ? 'border-white/60 bg-black/10' : 'border-primary bg-primary/5 text-primary'
              )}
            >
              <span className="block text-[10px] font-extrabold uppercase opacity-80">
                {quote.senderLabel}
              </span>
              <span className={cn('line-clamp-2', quote.isDeleted && 'italic')}>{quote.preview}</span>
            </button>
          ) : null}
          {text}
        </span>
      ) : null}
      {(text || mediaUrl) && meta ? (
        <div
          className={cn(
            'flex items-center gap-1 px-1 font-semibold tabular-nums',
            compact ? 'text-[10px]' : 'text-[11px]',
            mine ? 'justify-end' : 'justify-start'
          )}
          style={{ color: mine && t ? t.metaTimeMine : !mine && t ? t.metaTimeThem : undefined }}
        >
          {message.edited_at ? (
            <span className={!t ? 'text-muted' : undefined}>Edited</span>
          ) : null}
          <span className={!t ? 'text-muted' : undefined}>{timeLabel}</span>
          {mine && meta.showSent ? (
            meta.showRead ? (
              <IoCheckmarkDone
                size={14}
                style={{ color: t?.metaRead ?? '#6C63FF' }}
                aria-label="Read"
              />
            ) : (
              <IoCheckmark
                size={14}
                style={{ color: t?.metaTick ?? 'currentColor' }}
                aria-label="Sent"
              />
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
