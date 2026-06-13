import {
  canDeleteMessageForEveryone,
  canDeleteMessageForMe,
  canEditMessage,
  canReplyToMessage,
} from '@/lib/messaging/messageEditRules';
import { messageCopyText } from '@/lib/messaging/messageActions';
import type { MessageActionItem } from '@/features/messages/MessageActionsSheet';
import { MESSAGE_ACTION_ICONS } from '@/features/messages/MessageActionsSheet';
import type { SubscriptionTier } from '@/lib/subscription/types';
import type { ChatMessageRow } from '@/services/messages.service';

export type MessageActionHandlers = {
  onReply: () => void;
  onCopy: () => void;
  onForward: () => void;
  onEdit: () => void;
  onPin: () => void;
  onUnpin: () => void;
  onToggleReceipt?: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
};

export type BuildMessageActionsInput = {
  message: ChatMessageRow;
  viewerId: string;
  viewerTier: SubscriptionTier;
  pinnedMessageId: string | null;
  hiddenForViewer: boolean;
  lastOwnSentMessageId: string | null;
  hasMedia: boolean;
  mediaKind: 'image' | 'video' | null;
  isGroupChat?: boolean;
  handlers: MessageActionHandlers;
};

/**
 * Reply (received) → Copy → Forward → Edit → Pin → Hide receipt (Platinum) → Delete for me → Delete for everyone.
 */
export function buildMessageActions(input: BuildMessageActionsInput): MessageActionItem[] {
  const {
    message: m,
    viewerId,
    viewerTier,
    pinnedMessageId,
    hiddenForViewer,
    lastOwnSentMessageId,
    hasMedia,
    mediaKind,
    isGroupChat,
    handlers,
  } = input;

  if (m.sender_id === null) return [];

  const isDel = !!m.deleted_at;
  const isMine = m.sender_id === viewerId;
  const copyText = messageCopyText(m, { hasMedia, mediaKind });
  const canCopy = !isDel && copyText.length > 0;
  const canReply = !isGroupChat && canReplyToMessage(m, viewerId);
  const canForward = !isDel;
  const canEdit = isMine && canEditMessage(m, viewerId);
  const isPinned = pinnedMessageId === m.id;
  const canDeleteMe = canDeleteMessageForMe(m, hiddenForViewer);
  const canDeleteEveryone =
    isMine && canDeleteMessageForEveryone(m, viewerId, viewerTier, { lastOwnSentMessageId });

  const items: MessageActionItem[] = [];

  if (canReply) {
    items.push({
      key: 'reply',
      label: 'Reply',
      icon: MESSAGE_ACTION_ICONS.reply,
      onPress: handlers.onReply,
    });
  }
  if (canCopy) {
    items.push({
      key: 'copy',
      label: 'Copy',
      icon: MESSAGE_ACTION_ICONS.copy,
      onPress: handlers.onCopy,
    });
  }
  if (canForward) {
    items.push({
      key: 'forward',
      label: 'Forward',
      icon: MESSAGE_ACTION_ICONS.forward,
      onPress: handlers.onForward,
    });
  }
  if (canEdit) {
    items.push({
      key: 'edit',
      label: 'Edit',
      icon: MESSAGE_ACTION_ICONS.edit,
      onPress: handlers.onEdit,
    });
  }
  if (isPinned) {
    items.push({
      key: 'unpin',
      label: 'Unpin',
      icon: MESSAGE_ACTION_ICONS.unpin,
      onPress: handlers.onUnpin,
    });
  } else if (!isDel) {
    items.push({
      key: 'pin',
      label: 'Pin',
      icon: MESSAGE_ACTION_ICONS.pin,
      onPress: handlers.onPin,
    });
  }
  if (
    viewerTier === 'PLATINUM' &&
    isMine &&
    !isDel &&
    !isGroupChat &&
    handlers.onToggleReceipt
  ) {
    items.push({
      key: 'toggle-receipt',
      label: m.receipt_hidden ? 'Show receipt' : 'Hide receipt',
      icon: m.receipt_hidden ? MESSAGE_ACTION_ICONS.showReceipt : MESSAGE_ACTION_ICONS.hideReceipt,
      onPress: handlers.onToggleReceipt,
    });
  }
  if (canDeleteMe) {
    items.push({
      key: 'delete-me',
      label: 'Delete for me',
      icon: MESSAGE_ACTION_ICONS.delete,
      destructive: true,
      onPress: handlers.onDeleteForMe,
    });
  }
  if (canDeleteEveryone) {
    items.push({
      key: 'delete-everyone',
      label: 'Delete for everyone',
      icon: MESSAGE_ACTION_ICONS.delete,
      destructive: true,
      onPress: handlers.onDeleteForEveryone,
    });
  }

  return items;
}
