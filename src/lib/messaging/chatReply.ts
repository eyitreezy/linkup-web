import { messageDisplayText } from '@/lib/messaging/messagePreview';
import type { ChatMessageRow } from '@/services/messages.service';

export type ReplyQuotePreview = {
  messageId: string;
  senderId: string;
  senderLabel: string;
  preview: string;
  isDeleted: boolean;
};

export function buildReplyQuoteFromTarget(
  target: ChatMessageRow,
  peerName: string,
  myUserId: string
): ReplyQuotePreview {
  const mine = target.sender_id === myUserId;
  const text = messageDisplayText(target)?.trim();
  let preview = text;
  if (!preview && target.mediaKind) preview = target.mediaKind === 'video' ? 'Video' : 'Photo';
  if (!preview && (target.mediaUrl || target.media_id)) preview = 'Attachment';
  if (!preview) preview = 'Message';
  if (target.deleted_at) {
    return {
      messageId: target.id,
      senderId: target.sender_id ?? '',
      senderLabel: mine ? 'You' : peerName,
      preview: 'Message deleted',
      isDeleted: true,
    };
  }
  return {
    messageId: target.id,
    senderId: target.sender_id ?? '',
    senderLabel: mine ? 'You' : peerName,
    preview,
    isDeleted: false,
  };
}

export function resolveReplyQuote(
  message: ChatMessageRow,
  messagesById: Map<string, ChatMessageRow>,
  peerName: string,
  myUserId: string
): ReplyQuotePreview | null {
  const parentId = message.reply_to_message_id;
  if (!parentId) return null;
  const parent = messagesById.get(parentId);
  if (!parent) {
    return {
      messageId: parentId,
      senderId: '',
      senderLabel: 'Unknown',
      preview: 'Original message',
      isDeleted: false,
    };
  }
  return buildReplyQuoteFromTarget(parent, peerName, myUserId);
}
