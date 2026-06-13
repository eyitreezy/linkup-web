import { messageDisplayText, parseLegacyImageBody } from '@/lib/messaging/messagePreview';
import type { ChatMessageRow } from '@/services/messages.service';

/** Clipboard-friendly text for copy action. */
export function messageCopyText(
  m: ChatMessageRow,
  opts?: { hasMedia?: boolean; mediaKind?: 'image' | 'video' | null }
): string {
  const text = messageDisplayText(m)?.trim() ?? '';
  if (text) return text;
  if (opts?.hasMedia) return opts.mediaKind === 'video' ? 'Video' : 'Photo';
  return '';
}

export function messageActionMediaMeta(
  m: ChatMessageRow
): { hasMedia: boolean; mediaKind: 'image' | 'video' | null } {
  const display = messageDisplayText(m);
  const legacy = parseLegacyImageBody(display);
  const hasMedia = !!(m.mediaUrl || m.media_id || legacy);
  let mediaKind: 'image' | 'video' | null = m.mediaKind ?? null;
  if (!mediaKind && legacy) mediaKind = 'image';
  return { hasMedia, mediaKind };
}
