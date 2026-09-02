'use client';

import { SmartSuggestionsBar } from '@/components/chat/SmartSuggestionsBar';
import { ArrivalNudgeButton } from '@/components/plans/ArrivalNudgeButton';
import { LiveLocationViewer } from '@/components/plans/LiveLocationViewer';
import { LiveLocationSharingOverlays } from '@/components/plans/LiveLocationSharingOverlays';
import { useLiveLocationSharing } from '@/hooks/use-live-location-sharing';
import { AvatarWithPresence } from '@/components/presence/AvatarWithPresence';
import { usePresence } from '@/contexts/PresenceContext';
import { ChatAppearanceSheet } from '@/features/messages/ChatAppearanceSheet';
import { ChatMessageBubble } from '@/features/messages/ChatMessageBubble';
import { ChatReportDialog } from '@/features/messages/ChatReportDialog';
import { ChatSafetySheet } from '@/features/messages/ChatSafetySheet';
import { ChatComposer } from '@/features/messages/ChatComposer';
import { GroupMentionPicker } from '@/features/messages/GroupMentionPicker';
import { EditMessageDialog } from '@/features/messages/EditMessageDialog';
import { ForwardMessageDialog } from '@/features/messages/ForwardMessageDialog';
import { MessageActionsSheet } from '@/features/messages/MessageActionsSheet';
import { ConfirmDialog } from '@/features/plan-management/ConfirmDialog';
import { ChatSearchBar } from '@/features/messages/ChatSearchBar';
import { GroupAvatarCell } from '@/features/messages/GroupAvatarCell';
import { PinnedMessageBanner } from '@/features/messages/PinnedMessageBanner';
import { ChatTypingIndicator } from '@/features/messages/ChatTypingIndicator';
import { getSmartSuggestions } from '@/lib/chat/smartSuggestions';
import {
  buildReplyQuoteFromTarget,
  resolveReplyQuote,
  type ReplyQuotePreview,
} from '@/lib/messaging/chatReply';
import { getPinnedMessageId, setPinnedMessageId } from '@/lib/messaging/chatPins';
import { buildMessageActions } from '@/lib/messaging/buildMessageActions';
import { deleteMessageForEveryone } from '@/lib/messaging/deleteMessage';
import { editMessage } from '@/lib/messaging/editMessage';
import {
  encodeGroupMentions,
  filterMentionMembers,
  formatGroupMentionsForDisplay,
  getActiveMentionQuery,
  insertMentionLabel,
  type GroupMentionMember,
} from '@/lib/messaging/groupMentions';
import { findLastOwnSentMessageId } from '@/lib/messaging/messageEditRules';
import { messageActionMediaMeta } from '@/lib/messaging/messageActions';
import {
  fetchHiddenMessageIdsForConversation,
  filterMessagesHiddenForUser,
  hideMessageForMe,
} from '@/lib/messaging/messageDeletions';
import { messageDisplayText } from '@/lib/messaging/messagePreview';
import { useIsMobileShellLayout } from '@/hooks/use-media-query';
import {
  DEFAULT_CHAT_APPEARANCE,
  loadChatAppearance,
  presetForState,
  resolveBubbleTheme,
  saveChatAppearance,
  type ChatAppearanceState,
} from '@/lib/messaging/chatAppearance';
import { formatMessageTime } from '@/lib/messaging/formatMessageTime';
import { fetchActiveMeetupWithPeer, type LinkedMeetup } from '@/lib/messaging/fetchActiveMeetupWithPeer';
import { invalidateInboxQueries } from '@/lib/messaging/invalidate';
import {
  applyMessageRealtimeEvent,
  upsertMessageInCache,
} from '@/lib/messaging/messageCache';
import { messagesQueryKey } from '@/lib/messaging/queryKeys';
import { useInboxQuery } from '@/lib/messaging/useInboxQuery';
import {
  fetchPeerReadCursor,
  type ConversationReadRow,
} from '@/lib/messaging/conversationReads';
import { fetchActiveGroupMembers, type GroupChatMemberRow } from '@/lib/messaging/groupChatMembers';
import { setConversationLastRead } from '@/lib/messaging/inboxCache';
import { isMessageReadByPeerCursor } from '@/lib/messaging/readReceiptUtils';
import { approxReadByMessageId } from '@/lib/messaging/readReceipts';
import { searchMessagesInConversation } from '@/lib/messaging/searchMessages';
import { subscribeConversationReadsRealtime } from '@/lib/messaging/subscribeConversationReadsRealtime';
import { subscribeGroupMembersRealtime } from '@/lib/messaging/subscribeGroupMembersRealtime';
import { toggleMessageReceipt } from '@/lib/messaging/toggleMessageReceipt';
import { usePermission } from '@/hooks/usePermission';
import { useSubscriptionContext } from '@/lib/subscription/SubscriptionContext';
import { suggestMeetingAreaLine } from '@/lib/places/suggestMeetingArea';
import { derivePresenceUi } from '@/lib/presence/hostPresenceStatus';
import { TYPING_STALE_MS } from '@/lib/presence/presenceConstants';
import {
  fetchUserPresence,
  subscribeUserPresenceRealtime,
} from '@/lib/presence/subscribeUserPresenceRealtime';
import { getVisibilityPrefs, typingVisibleToViewer } from '@/lib/presence/visibilityPrefs';
import { createClient } from '@/lib/supabase/client';
import { fetchUserProfileBundle } from '@/services/profile.service';
import {
  fetchMessages,
  forwardMessageToConversation,
  sendMediaMessage,
  sendTextMessage,
  subscribeToMessages,
  type ChatMessageRow,
  type InboxRow,
} from '@/services/messages.service';
import { useAuthStore } from '@/stores/auth-store';
import type { DbProfile, DbUserPresence } from '@/types/database';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IoCheckmarkCircle,
  IoChevronBack,
  IoChevronForward,
  IoColorPaletteOutline,
  IoEllipsisHorizontal,
  IoInformationCircleOutline,
  IoSearchOutline,
  IoSparkles,
} from 'react-icons/io5';

type ChatSuggestionPlan = {
  status: string;
  scheduled_at: string | null;
  meet_type_id: string | null;
  creator_id: string;
};

type Props = {
  conversationId: string;
  peer: InboxRow;
  /** Mobile: back to inbox (matches app chat header). */
  onBack?: () => void;
  /** Group chat plan context for smart suggestion chips. */
  suggestionPlan?: ChatSuggestionPlan | null;
};

export function ChatThread({ conversationId, peer, onBack, suggestionPlan }: Props) {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const isMobile = useIsMobileShellLayout();
  const scrollRef = useRef<HTMLDivElement>(null);
  const composeInputRef = useRef<HTMLTextAreaElement>(null);
  const messageRefs = useRef(new Map<string, HTMLDivElement>());
  const isNearBottomRef = useRef(true);
  const shouldScrollToBottomRef = useRef(false);
  const messageRefetchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queryClient = useQueryClient();
  const { signalTyping, clearTyping } = usePresence();

  const [text, setText] = useState('');
  const [composeSelection, setComposeSelection] = useState({ start: 0, end: 0 });
  const [mentionPickerSuppressed, setMentionPickerSuppressed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [peerPresence, setPeerPresence] = useState<DbUserPresence | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const peerPresenceRef = useRef(peerPresence);
  const [linkedMeetup, setLinkedMeetup] = useState<LinkedMeetup | null>(null);
  const [myNudgedAt, setMyNudgedAt] = useState<string | null>(null);
  const [partnerNudgedAt, setPartnerNudgedAt] = useState<string | null>(null);
  const [nudgeReportedUserId, setNudgeReportedUserId] = useState<string | null>(null);
  const [appearance, setAppearance] = useState<ChatAppearanceState>(DEFAULT_CHAT_APPEARANCE);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMemberId, setReportMemberId] = useState<string | null>(null);
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [placeBusy, setPlaceBusy] = useState(false);
  const [partnerLocationSessionId, setPartnerLocationSessionId] = useState<string | null>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<ChatMessageRow | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [pendingReply, setPendingReply] = useState<ReplyQuotePreview | null>(null);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardTarget, setForwardTarget] = useState<ChatMessageRow | null>(null);
  const [forwardBusy, setForwardBusy] = useState(false);
  const [pinnedMessageId, setPinnedId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [hiddenForMeIds, setHiddenForMeIds] = useState<Set<string>>(() => new Set());
  const [editModal, setEditModal] = useState<{ messageId: string; draft: string } | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteForMeTarget, setDeleteForMeTarget] = useState<ChatMessageRow | null>(null);
  const [deleteForEveryoneTarget, setDeleteForEveryoneTarget] = useState<ChatMessageRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [peerReadCursor, setPeerReadCursor] = useState<ConversationReadRow | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [serverSearchIds, setServerSearchIds] = useState<string[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [groupMembers, setGroupMembers] = useState<GroupChatMemberRow[]>([]);

  const isGroupChat = !!peer.isGroupChat;
  const { subscriptionState } = useSubscriptionContext();
  const viewerTier = subscriptionState.effectiveTier;
  const { allowed: hasReadReceipts } = usePermission('messaging.read_receipts');

  const { data: viewerBundle } = useQuery({
    queryKey: ['profile-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return fetchUserProfileBundle(createClient(), user.id);
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });
  const viewerProfile = viewerBundle?.profile ?? null;

  const { data: peerProfile } = useQuery({
    queryKey: ['peer-profile', peer.otherId],
    queryFn: async () => {
      const client = createClient();
      const { data } = await client.from('profiles').select('*').eq('user_id', peer.otherId).maybeSingle();
      return (data as DbProfile | null) ?? null;
    },
    enabled: !!peer.otherId && !isGroupChat,
  });

  useEffect(() => {
    void loadChatAppearance().then(setAppearance);
  }, []);

  useEffect(() => {
    if (!user?.id || !peer.otherId || isGroupChat) return;
    void fetchActiveMeetupWithPeer(user.id, peer.otherId).then(setLinkedMeetup);
  }, [user?.id, peer.otherId, isGroupChat]);

  const nudgePlanId = isGroupChat ? peer.planId ?? null : linkedMeetup?.id ?? null;
  const nudgePlanStatus = isGroupChat ? suggestionPlan?.status ?? '' : linkedMeetup?.status ?? '';
  const nudgeScheduledAt = isGroupChat ? suggestionPlan?.scheduled_at ?? null : linkedMeetup?.scheduled_at ?? null;

  const liveLocation = useLiveLocationSharing(nudgePlanId, user?.id ?? null);

  useEffect(() => {
    if (!user?.id || !nudgePlanId) {
      setMyNudgedAt(null);
      setPartnerNudgedAt(null);
      setNudgeReportedUserId(peer.otherId ?? null);
      return;
    }
    const client = createClient();
    void client
      .from('plan_arrival_nudges')
      .select('user_id, nudged_at')
      .eq('plan_id', nudgePlanId)
      .then(({ data }) => {
        const rows = data ?? [];
        const mine = rows.find((r) => r.user_id === user.id);
        const others = rows.filter((r) => r.user_id !== user.id);
        const earliestOther = others.sort(
          (a, b) => new Date(a.nudged_at).getTime() - new Date(b.nudged_at).getTime()
        )[0];
        setMyNudgedAt((mine?.nudged_at as string) ?? null);
        setPartnerNudgedAt((earliestOther?.nudged_at as string) ?? null);
        setNudgeReportedUserId(
          (earliestOther?.user_id as string) ??
            (isGroupChat && suggestionPlan?.creator_id !== user.id
              ? suggestionPlan?.creator_id ?? null
              : peer.otherId ?? null)
        );
      });
  }, [user?.id, nudgePlanId, peer.otherId, isGroupChat, suggestionPlan?.creator_id]);

  useEffect(() => {
    if (!user?.id || !nudgePlanId) {
      setPartnerLocationSessionId(null);
      return;
    }
    const client = createClient();

    void client
      .from('live_location_sessions')
      .select('id, sharer_id')
      .eq('plan_id', nudgePlanId)
      .eq('is_active', true)
      .neq('sharer_id', user.id)
      .maybeSingle()
      .then(({ data }) => setPartnerLocationSessionId(data?.id ?? null));

    const channel = client
      .channel(`live-loc-sessions:${nudgePlanId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_location_sessions',
          filter: `plan_id=eq.${nudgePlanId}`,
        },
        () => {
          void client
            .from('live_location_sessions')
            .select('id, sharer_id')
            .eq('plan_id', nudgePlanId)
            .eq('is_active', true)
            .neq('sharer_id', user.id)
            .maybeSingle()
            .then(({ data }) => setPartnerLocationSessionId(data?.id ?? null));
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [user?.id, nudgePlanId]);

  useEffect(() => {
    if (!isGroupChat || !conversationId) return;
    const client = createClient();
    const unsub = subscribeGroupMembersRealtime(client, conversationId, setGroupMembers);
    return unsub;
  }, [isGroupChat, conversationId]);

  useEffect(() => {
    if (!peer.otherId || isGroupChat) return;
    let cancelled = false;
    void fetchUserPresence(peer.otherId).then((row) => {
      if (!cancelled) setPeerPresence(row);
    });
    const unsub = subscribeUserPresenceRealtime(peer.otherId, (row) => setPeerPresence(row));
    return () => {
      cancelled = true;
      unsub();
    };
  }, [peer.otherId, isGroupChat]);

  useEffect(() => {
    peerPresenceRef.current = peerPresence;
  }, [peerPresence]);

  useEffect(() => {
    const id = setInterval(() => {
      const row = peerPresenceRef.current;
      if (!row) {
        setPeerTyping(false);
        return;
      }
      const typing =
        row.typing_conversation_id === conversationId &&
        !!row.typing_updated_at &&
        Date.now() - new Date(row.typing_updated_at).getTime() < TYPING_STALE_MS;
      setPeerTyping(typing);
    }, 600);
    return () => clearInterval(id);
  }, [conversationId]);

  const chatPreset = useMemo(() => presetForState(appearance), [appearance]);
  const bubbleTheme = useMemo(
    () => resolveBubbleTheme(chatPreset, appearance, { compact: isMobile }),
    [chatPreset, appearance, isMobile]
  );

  const headerPresence = useMemo(
    () => derivePresenceUi(viewerProfile, peerProfile?.preferences, peerPresence),
    [viewerProfile, peerProfile?.preferences, peerPresence]
  );

  const showTypingIndicator =
    !isGroupChat && peerTyping && typingVisibleToViewer(viewerProfile, peerProfile?.preferences);
  const readReceiptsOn =
    !isGroupChat && hasReadReceipts && getVisibilityPrefs(viewerProfile).read_receipts;

  const memberByUserId = useMemo(() => {
    const map = new Map<string, GroupChatMemberRow>();
    for (const m of groupMembers) map.set(m.user_id, m);
    return map;
  }, [groupMembers]);

  const mentionMembers = useMemo<GroupMentionMember[]>(
    () =>
      groupMembers.map((m) => ({
        userId: m.user_id,
        displayName: m.user?.display_name?.trim() || 'Member',
      })),
    [groupMembers]
  );

  const mentionNameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of mentionMembers) map.set(m.userId, m.displayName);
    return map;
  }, [mentionMembers]);

  const mentionAvatarByUserId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const m of groupMembers) map.set(m.user_id, m.user?.avatar_url ?? null);
    return map;
  }, [groupMembers]);

  const activeMention = useMemo(
    () => (isGroupChat ? getActiveMentionQuery(text, composeSelection.end) : null),
    [isGroupChat, text, composeSelection.end]
  );

  const mentionPickerMembers = useMemo(
    () =>
      filterMentionMembers(mentionMembers, activeMention?.query ?? '', {
        excludeUserId: user?.id,
      }),
    [mentionMembers, activeMention?.query, user?.id]
  );

  useEffect(() => {
    if (!conversationId || !peer.otherId || isGroupChat) {
      setPeerReadCursor(null);
      return;
    }
    let cancelled = false;
    const client = createClient();
    void fetchPeerReadCursor(client, conversationId, peer.otherId).then((row) => {
      if (!cancelled) setPeerReadCursor(row);
    });
    return () => {
      cancelled = true;
    };
  }, [conversationId, peer.otherId, isGroupChat]);

  useEffect(() => {
    if (!conversationId || isGroupChat) return;
    const client = createClient();
    const unsub = subscribeConversationReadsRealtime(client, conversationId, {
      onUpsert: (row) => {
        if (!user?.id || row.user_id === user.id) return;
        setPeerReadCursor(row);
      },
    });
    return unsub;
  }, [conversationId, user?.id, isGroupChat]);

  const { data: inboxData } = useInboxQuery();
  const inboxRows = inboxData?.rows ?? [];

  useEffect(() => {
    if (!user?.id) return;
    setPinnedId(getPinnedMessageId(user.id, conversationId));
  }, [user?.id, conversationId]);

  const { data: messages, isLoading, error } = useQuery({
    queryKey: messagesQueryKey(conversationId),
    queryFn: async () => {
      const client = createClient();
      const { data, error: err } = await fetchMessages(client, conversationId);
      if (err) throw new Error(String(err));
      return data ?? [];
    },
    enabled: !!conversationId,
  });

  useEffect(() => {
    if (!user?.id || !conversationId) return;
    let cancelled = false;
    const client = createClient();
    void fetchHiddenMessageIdsForConversation(client, user.id, conversationId).then((ids) => {
      if (!cancelled) setHiddenForMeIds(new Set(ids));
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, conversationId]);

  const visibleMessages = useMemo(
    () => filterMessagesHiddenForUser(messages ?? [], hiddenForMeIds),
    [messages, hiddenForMeIds]
  );

  const planForSuggestions = useMemo((): ChatSuggestionPlan | null => {
    if (isGroupChat) return suggestionPlan ?? null;
    if (!linkedMeetup) return null;
    return {
      status: linkedMeetup.status,
      scheduled_at: linkedMeetup.scheduled_at,
      meet_type_id: linkedMeetup.meet_type_id,
      creator_id: linkedMeetup.creator_id,
    };
  }, [isGroupChat, suggestionPlan, linkedMeetup]);

  const smartSuggestions = useMemo(() => {
    if (!user?.id || !planForSuggestions) return [];

    const countableMessages = visibleMessages.filter((m) => m.sender_id !== null);
    const lastMessage = countableMessages[countableMessages.length - 1];

    return getSmartSuggestions({
      plan: {
        status: planForSuggestions.status,
        scheduled_at: planForSuggestions.scheduled_at,
        meet_type_id: planForSuggestions.meet_type_id,
      },
      isHost: planForSuggestions.creator_id === user.id,
      isGroupChat,
      messageCount: countableMessages.length,
      lastMessageIsFromOther:
        countableMessages.length > 0 && lastMessage?.sender_id !== user.id,
      composeValue: text,
    });
  }, [user?.id, planForSuggestions, isGroupChat, visibleMessages, text]);

  const lastOwnSentMessageId = useMemo(
    () => (user?.id ? findLastOwnSentMessageId(visibleMessages, user.id) : null),
    [visibleMessages, user?.id]
  );

  const approxRead = useMemo(
    () => approxReadByMessageId(visibleMessages, user?.id),
    [visibleMessages, user?.id]
  );

  const clientSearchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    return visibleMessages
      .filter(
        (m) =>
          !m.deleted_at &&
          !hiddenForMeIds.has(m.id) &&
          m.sender_id !== null &&
          (m.text ?? m.body ?? '').toLowerCase().includes(q)
      )
      .map((m) => m.id);
  }, [searchQuery, visibleMessages, hiddenForMeIds]);

  const searchResults = useMemo(() => {
    const merged = new Set([...clientSearchResults, ...serverSearchIds]);
    const ordered = visibleMessages.filter((m) => merged.has(m.id)).map((m) => m.id);
    for (const id of serverSearchIds) {
      if (!ordered.includes(id)) ordered.push(id);
    }
    return ordered;
  }, [clientSearchResults, serverSearchIds, visibleMessages]);

  useEffect(() => {
    if (!user?.id || searchQuery.trim().length < 3) {
      setServerSearchIds([]);
      return;
    }
    const timer = window.setTimeout(() => {
      setSearchBusy(true);
      const client = createClient();
      void searchMessagesInConversation(client, conversationId, searchQuery, user.id).then((rows) => {
        setServerSearchIds(rows.map((r) => r.id));
        setSearchBusy(false);
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [searchQuery, conversationId, user?.id]);

  useEffect(() => {
    setSearchIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    const id = searchResults[searchIndex];
    if (id) scrollToMessage(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scroll when navigating results
  }, [searchIndex, searchResults.length]);

  function isMessageRead(m: ChatMessageRow): boolean {
    if (!readReceiptsOn || m.receipt_hidden) return false;
    const byCursor = isMessageReadByPeerCursor(m.id, m.created_at, visibleMessages, peerReadCursor);
    const byHeuristic = approxRead.get(m.id) ?? false;
    return byCursor || byHeuristic;
  }

  const messagesById = useMemo(() => {
    const map = new Map<string, ChatMessageRow>();
    for (const m of visibleMessages) map.set(m.id, m);
    return map;
  }, [visibleMessages]);

  const pinnedQuote = useMemo(() => {
    if (!pinnedMessageId || !user?.id || hiddenForMeIds.has(pinnedMessageId)) return null;
    const msg = messagesById.get(pinnedMessageId);
    if (!msg) return null;
    const quote = buildReplyQuoteFromTarget(msg, peer.name, user.id);
    return {
      ...quote,
      preview: isGroupChat
        ? formatGroupMentionsForDisplay(quote.preview, mentionNameByUserId)
        : quote.preview,
    };
  }, [pinnedMessageId, messagesById, peer.name, user?.id, hiddenForMeIds, isGroupChat, mentionNameByUserId]);

  function scrollToMessage(messageId: string) {
    const el = messageRefs.current.get(messageId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedId(messageId);
      window.setTimeout(() => setHighlightedId(null), 2000);
    }
  }

  function openActionsFor(m: ChatMessageRow) {
    const items = buildActionItems(m);
    if (items.length === 0) return;
    setActionTarget(m);
    setActionsOpen(true);
  }

  function buildActionItems(m: ChatMessageRow) {
    if (!user?.id) return [];
    const { hasMedia, mediaKind } = messageActionMediaMeta(m);
    const rawStored = messageDisplayText(m)?.trim() ?? '';
    const rawText = isGroupChat
      ? formatGroupMentionsForDisplay(rawStored, mentionNameByUserId)
      : rawStored;
    const copyText = rawText || (hasMedia ? (mediaKind === 'video' ? 'Video' : 'Photo') : '');

    return buildMessageActions({
      message: m,
      viewerId: user.id,
      viewerTier,
      pinnedMessageId,
      hiddenForViewer: hiddenForMeIds.has(m.id),
      lastOwnSentMessageId,
      hasMedia,
      mediaKind,
      isGroupChat,
      handlers: {
        onReply: () => {
          const quote = buildReplyQuoteFromTarget(m, peer.name, user.id);
          setPendingReply({
            ...quote,
            preview: isGroupChat
              ? formatGroupMentionsForDisplay(quote.preview, mentionNameByUserId)
              : quote.preview,
          });
        },
        onCopy: () => {
          void navigator.clipboard.writeText(copyText).then(() => {
            setCopyToast('Copied to clipboard');
            window.setTimeout(() => setCopyToast(null), 2000);
          });
        },
        onForward: () => {
          setForwardTarget(m);
          setForwardOpen(true);
        },
        onEdit: () => {
          setEditError(null);
          setEditModal({ messageId: m.id, draft: rawText });
        },
        onPin: () => {
          setPinnedMessageId(user.id, conversationId, m.id);
          setPinnedId(m.id);
        },
        onUnpin: () => {
          setPinnedMessageId(user.id, conversationId, null);
          setPinnedId(null);
        },
        onToggleReceipt: () => void runToggleReceipt(m, !m.receipt_hidden),
        onDeleteForMe: () => setDeleteForMeTarget(m),
        onDeleteForEveryone: () => setDeleteForEveryoneTarget(m),
      },
    });
  }

  async function runToggleReceipt(m: ChatMessageRow, hidden: boolean) {
    const client = createClient();
    const result = await toggleMessageReceipt(client, m.id, hidden);
    if (!result.ok) {
      setSendError(result.error);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: messagesQueryKey(conversationId) });
  }

  async function runDeleteForMe(m: ChatMessageRow) {
    if (!user?.id) return;
    setDeleteBusy(true);
    const client = createClient();
    const result = await hideMessageForMe(client, user.id, m.id, conversationId);
    setDeleteBusy(false);
    setDeleteForMeTarget(null);
    if (!result.ok) {
      setSendError(result.error);
      return;
    }
    setHiddenForMeIds((prev) => new Set([...prev, m.id]));
    if (pinnedMessageId === m.id) {
      setPinnedMessageId(user.id, conversationId, null);
      setPinnedId(null);
    }
    invalidateInboxQueries(queryClient, user.id);
  }

  async function runDeleteForEveryone(m: ChatMessageRow) {
    if (!user?.id) return;
    setDeleteBusy(true);
    const client = createClient();
    const result = await deleteMessageForEveryone(client, m, user.id, viewerTier, lastOwnSentMessageId);
    setDeleteBusy(false);
    setDeleteForEveryoneTarget(null);
    if (!result.ok) {
      setSendError(result.error);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: messagesQueryKey(conversationId) });
    invalidateInboxQueries(queryClient, user.id);
  }

  async function saveEditedMessage() {
    if (!editModal || !user?.id) return;
    const draft = editModal.draft.trim();
    const body = isGroupChat ? encodeGroupMentions(draft, mentionMembers) : draft;
    if (!body) {
      setEditError('Add some text or cancel.');
      return;
    }
    const source = visibleMessages.find((msg) => msg.id === editModal.messageId);
    if (!source) {
      setEditError('Message not found.');
      setEditModal(null);
      return;
    }
    setEditBusy(true);
    setEditError(null);
    const client = createClient();
    const result = await editMessage(client, source, user.id, body);
    setEditBusy(false);
    if (!result.ok) {
      if (result.code === 'unchanged') {
        setEditModal(null);
        return;
      }
      setEditError(result.error);
      return;
    }
    setEditModal(null);
    void queryClient.invalidateQueries({ queryKey: messagesQueryKey(conversationId) });
    invalidateInboxQueries(queryClient, user.id);
  }

  const canOpenPlanDispute = useMemo(
    () =>
      !!linkedMeetup &&
      ['agreed', 'awaiting_payment', 'active', 'completed'].includes(linkedMeetup.status),
    [linkedMeetup]
  );

  const markRead = useCallback(() => {
    const list = visibleMessages;
    const last = list[list.length - 1];
    if (last?.created_at) {
      setConversationLastRead(conversationId, last.created_at, last.id);
      invalidateInboxQueries(queryClient, user?.id);
    }
  }, [conversationId, visibleMessages, queryClient, user?.id]);

  useEffect(() => {
    isNearBottomRef.current = true;
    shouldScrollToBottomRef.current = true;
  }, [conversationId]);

  useEffect(() => {
    const client = createClient();
    const scheduleMessageRefetch = () => {
      if (messageRefetchDebounceRef.current) clearTimeout(messageRefetchDebounceRef.current);
      messageRefetchDebounceRef.current = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: messagesQueryKey(conversationId) });
      }, 280);
    };

    const sub = subscribeToMessages(client, conversationId, (payload) => {
      const result = applyMessageRealtimeEvent(queryClient, conversationId, payload);
      if (result === 'needs-refetch') {
        scheduleMessageRefetch();
      }
      invalidateInboxQueries(queryClient, user?.id);
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const senderId = payload.new.sender_id as string | null | undefined;
        if (senderId && senderId !== user?.id && isNearBottomRef.current) {
          shouldScrollToBottomRef.current = true;
        }
      }
    });
    return () => {
      if (messageRefetchDebounceRef.current) clearTimeout(messageRefetchDebounceRef.current);
      void client.removeChannel(sub);
    };
  }, [conversationId, queryClient, user?.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const updateNearBottom = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      isNearBottomRef.current = distanceFromBottom < 96;
    };

    updateNearBottom();
    el.addEventListener('scroll', updateNearBottom, { passive: true });
    return () => el.removeEventListener('scroll', updateNearBottom);
  }, [conversationId]);

  useEffect(() => {
    if (!shouldScrollToBottomRef.current && !isNearBottomRef.current) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    shouldScrollToBottomRef.current = false;
  }, [visibleMessages, showTypingIndicator]);

  useEffect(() => {
    if (visibleMessages.length) markRead();
  }, [visibleMessages, markRead]);

  const messageInputLook = useMemo(
    () => ({
      inputBg: chatPreset.composerInputBg,
      inputText: chatPreset.composerInputText,
      inputBorder: chatPreset.composerInputBorder,
      inputPlaceholder: chatPreset.composerInputPlaceholder,
      attachIcon: chatPreset.composerAttachIcon,
      sendActive: chatPreset.sendActive,
      fontSize: bubbleTheme.fontSize,
      fontWeight: bubbleTheme.fontWeight,
    }),
    [chatPreset, bubbleTheme]
  );

  const threadBgStyle = useMemo(
    () => ({
      background: `linear-gradient(160deg, ${chatPreset.threadGradient.join(', ')})`,
    }),
    [chatPreset.threadGradient]
  );

  async function handleSend() {
    if (!user?.id || !text.trim() || sending) return;
    setSendError(null);
    setSending(true);
    const client = createClient();
    const replyId = pendingReply?.messageId ?? null;
    const outbound = isGroupChat ? encodeGroupMentions(text, mentionMembers) : text;
    const { data: sent, error: err } = await sendTextMessage(
      client,
      conversationId,
      user.id,
      outbound,
      replyId
    );
    setSending(false);
    clearTyping();
    if (err) {
      setSendError(err);
      return;
    }
    setText('');
    setComposeSelection({ start: 0, end: 0 });
    setPendingReply(null);
    if (sent) {
      upsertMessageInCache(queryClient, conversationId, sent);
      shouldScrollToBottomRef.current = true;
    } else {
      void queryClient.invalidateQueries({ queryKey: messagesQueryKey(conversationId) });
    }
    invalidateInboxQueries(queryClient, user?.id);
  }

  async function handleAttach(file: File) {
    if (!user?.id || sending) return;
    setSendError(null);
    setSending(true);
    const client = createClient();
    const { error: err } = await sendMediaMessage(client, conversationId, user.id, file, text);
    setSending(false);
    clearTyping();
    if (err) {
      setSendError(err);
      return;
    }
    setText('');
    shouldScrollToBottomRef.current = true;
    void queryClient.invalidateQueries({ queryKey: messagesQueryKey(conversationId) });
    invalidateInboxQueries(queryClient, user?.id);
  }

  function onQuickSendOffer() {
    if (linkedMeetup) {
      router.push(`/plan/${linkedMeetup.id}`);
      return;
    }
    if (window.confirm('Open Discover to find a hangout, or continue a plan you have already started?')) {
      router.push('/discover');
    }
  }

  async function onSuggestPlace() {
    setPlaceError(null);
    setPlaceBusy(true);
    const { line, error: err } = await suggestMeetingAreaLine();
    setPlaceBusy(false);
    if (err) {
      setPlaceError(err);
      return;
    }
    if (line) setText((t) => (t.trim() ? `${t.trim()}\n` : '') + line);
  }

  function handleComposerChange(value: string) {
    setText(value);
    if (conversationId && value.trim().length > 0) signalTyping(conversationId);
    if (value.length < text.length) return;
    if (value.includes('@')) setMentionPickerSuppressed(false);
  }

  function handleComposerSelection(start: number, end: number) {
    setComposeSelection({ start, end });
  }

  function handleSelectMention(member: GroupMentionMember) {
    if (!activeMention) return;
    const { text: next, selection } = insertMentionLabel(
      text,
      activeMention.start,
      composeSelection.end,
      member
    );
    setMentionPickerSuppressed(true);
    setText(next);
    setComposeSelection({ start: selection, end: selection });
    window.requestAnimationFrame(() => {
      if (!composeInputRef.current) return;
      composeInputRef.current.focus();
      composeInputRef.current.setSelectionRange(selection, selection);
    });
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="pointer-events-none absolute inset-0" style={threadBgStyle} aria-hidden />
      {appearance.backgroundImageUri ? (
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${appearance.backgroundImageUri})` }}
          aria-hidden
        />
      ) : null}

      <header
        className="relative z-10 flex shrink-0 items-center gap-1.5 border-b bg-gradient-to-r from-white/[0.98] via-[#f3eeff]/95 to-[#fff8fc]/92 px-2 py-2 backdrop-blur-sm min-[360px]:gap-3 min-[360px]:px-3 min-[360px]:py-3 lg:px-4"
        style={{ borderColor: chatPreset.headerHairline }}
      >
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground transition hover:bg-[#F5F6FA] active:scale-95 min-[360px]:h-10 min-[360px]:w-10"
            aria-label="Back to inbox"
          >
            <IoChevronBack className="h-[22px] w-[22px] min-[360px]:h-[26px] min-[360px]:w-[26px]" />
          </button>
        ) : null}
        {searchOpen ? (
          <ChatSearchBar
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onCancel={() => {
              setSearchOpen(false);
              setSearchQuery('');
              setSearchIndex(0);
              setServerSearchIds([]);
            }}
            resultCount={searchResults.length}
            currentIndex={searchIndex}
            searching={searchBusy}
            onPrevResult={() =>
              setSearchIndex((i) => (searchResults.length ? (i - 1 + searchResults.length) % searchResults.length : 0))
            }
            onNextResult={() =>
              setSearchIndex((i) => (searchResults.length ? (i + 1) % searchResults.length : 0))
            }
          />
        ) : (
          <>
        <div className="flex min-w-0 flex-1 items-center gap-2.5 min-[360px]:gap-3">
              {isGroupChat ? (
                <GroupAvatarCell
                  avatarUrl={peer.groupAvatarUrl}
                  groupName={peer.name}
                  memberPreviews={peer.memberPreviews}
                  size={44}
                />
              ) : (
          <AvatarWithPresence
            uri={peer.avatarUrl}
            name={peer.name}
            size={44}
            presence={headerPresence}
            showDot
          />
              )}
          <div className="min-w-0 flex-1">
                {isGroupChat ? (
                  <>
                    <h2 className="truncate font-display text-base font-extrabold text-foreground min-[360px]:text-lg">
                      {peer.name}
                    </h2>
                    {peer.planId ? (
                      <Link
                        href={`/plan/${peer.planId}`}
                        className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-gradient-to-r from-primary/15 to-secondary/10 px-2 py-0.5 text-[11px] font-extrabold text-primary min-[360px]:px-2.5 min-[360px]:py-1 min-[360px]:text-[12px]"
                      >
                        <IoSparkles size={14} />
                        <span className="truncate">View plan</span>
                        <IoChevronForward size={14} className="shrink-0 text-secondary" />
                      </Link>
                    ) : (
                      <p className="text-[11px] font-semibold text-muted min-[360px]:text-[12px]">
                        {peer.memberCount ?? groupMembers.length} members
                      </p>
                    )}
                  </>
                ) : peer.otherId ? (
              <Link
                href={`/user/${peer.otherId}`}
                className="block min-w-0"
                aria-label={`View ${peer.name}'s profile`}
              >
                <div className="flex items-center gap-1">
                  <span className="truncate font-display text-base font-extrabold text-foreground min-[360px]:text-lg">
                    {peer.name}
                  </span>
                  {peer.verified ? (
                    <IoCheckmarkCircle className="shrink-0 text-primary" size={17} aria-label="Verified" />
                  ) : null}
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-1">
                <h2 className="truncate font-display text-base font-extrabold text-foreground min-[360px]:text-lg">
                  {peer.name}
                </h2>
              </div>
            )}
                {!isGroupChat ? (
                  linkedMeetup ? (
              <Link
                href={`/plan/${linkedMeetup.id}`}
                className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-gradient-to-r from-primary/15 to-secondary/10 px-2 py-0.5 text-[11px] font-extrabold text-primary min-[360px]:px-2.5 min-[360px]:py-1 min-[360px]:text-[12px]"
              >
                <IoSparkles size={14} />
                <span className="truncate">{linkedMeetup.title}</span>
                <IoChevronForward size={14} className="shrink-0 text-secondary" />
              </Link>
            ) : headerPresence.caption ? (
              <p className="text-[11px] font-semibold text-muted min-[360px]:text-[12px]">{headerPresence.caption}</p>
            ) : (
              <p className="text-[11px] font-semibold text-muted min-[360px]:text-[12px]">Direct message</p>
                  )
                ) : null}
          </div>
        </div>
            {user?.id ? (
          <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  className="rounded-full p-2 text-muted transition hover:bg-[#F5F6FA]"
                  aria-label="Search messages"
                >
                  <IoSearchOutline size={22} />
                </button>
                {isGroupChat ? (
                  <Link
                    href={`/chat/group/${conversationId}/info`}
                    className="rounded-full p-2 text-muted transition hover:bg-[#F5F6FA]"
                    aria-label="Group info"
                  >
                    <IoInformationCircleOutline size={22} />
                  </Link>
                ) : null}
            <button
              type="button"
              onClick={() => setAppearanceOpen(true)}
              className="rounded-full p-2 text-muted transition hover:bg-[#F5F6FA]"
              aria-label="Chat appearance"
            >
              <IoColorPaletteOutline size={22} />
            </button>
                {user?.id && (peer.otherId || isGroupChat) ? (
            <button
              type="button"
              onClick={() => setSafetyOpen(true)}
              className="rounded-full p-2 text-muted transition hover:bg-[#F5F6FA]"
              aria-label="Safety and report"
            >
              <IoEllipsisHorizontal size={22} />
            </button>
                ) : null}
          </div>
        ) : null}
          </>
        )}
      </header>

      <div
        ref={scrollRef}
        className="relative z-10 min-h-0 flex-1 overflow-y-auto px-2.5 py-3 min-[360px]:px-3 min-[360px]:py-4 lg:px-4"
      >
        {isLoading ? (
          <p className="text-center text-[13px] font-semibold text-muted">Loading messages…</p>
        ) : error ? (
          <p className="text-center text-[13px] font-semibold text-[#EF4444]">
            {error instanceof Error ? error.message : 'Could not load messages'}
          </p>
        ) : (
          <div className="space-y-2 min-[360px]:space-y-3">
            {pinnedQuote ? (
              <PinnedMessageBanner
                quote={pinnedQuote}
                onPress={() => scrollToMessage(pinnedQuote.messageId)}
                onUnpin={() => {
                  if (!user?.id) return;
                  setPinnedMessageId(user.id, conversationId, null);
                  setPinnedId(null);
                }}
              />
            ) : null}
            {partnerLocationSessionId ? (
              <LiveLocationViewer
                partnerSessionId={partnerLocationSessionId}
                partnerName={isGroupChat ? undefined : peer.name}
              />
            ) : null}
            {visibleMessages.map((m) => {
              const isSystem = m.sender_id === null;
              const mine = !isSystem && m.sender_id === user?.id;
              const showRead = mine && readReceiptsOn && isMessageRead(m);
              const showSent = mine && (isGroupChat ? true : readReceiptsOn);
              const member = m.sender_id ? memberByUserId.get(m.sender_id) : undefined;
              const senderLabel =
                isGroupChat && !mine && !isSystem
                  ? m.group_sender_display ??
                    member?.user?.display_name ??
                    'Member'
                  : null;
              const quote =
                !isGroupChat && user?.id && m.reply_to_message_id
                  ? resolveReplyQuote(m, messagesById, peer.name, user.id)
                  : null;
              return (
                <ChatMessageBubble
                  key={m.id}
                  message={m}
                  mine={mine}
                  theme={bubbleTheme}
                  compact={isMobile}
                  quote={quote}
                  isSystem={isSystem}
                  senderLabel={senderLabel}
                  isAdmin={member?.is_admin}
                  highlighted={highlightedId === m.id}
                  mentionNameByUserId={isGroupChat ? mentionNameByUserId : undefined}
                  onOpenActions={isSystem ? undefined : () => openActionsFor(m)}
                  onQuotePress={() => {
                    if (quote?.messageId) scrollToMessage(quote.messageId);
                  }}
                  messageRef={(el) => {
                    if (el) messageRefs.current.set(m.id, el);
                    else messageRefs.current.delete(m.id);
                  }}
                  meta={{
                    timeLabel: formatMessageTime(m.created_at),
                    showSent,
                    showRead: isGroupChat ? false : showRead,
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      <ChatTypingIndicator visible={showTypingIndicator} peerName={peer.name} />

      <div
        className="relative z-10 shrink-0 border-t backdrop-blur-md max-lg:pb-[var(--linkup-bottom-nav-offset)]"
        style={{ backgroundColor: chatPreset.composerBg, borderColor: chatPreset.composerBorder }}
      >
        {placeError ? (
          <p className="px-2.5 pb-1 text-center text-[11px] font-semibold text-[#EF4444] min-[360px]:px-4 min-[360px]:text-[12px]">
            {placeError}
          </p>
        ) : null}
        {sendError ? (
          <p className="px-2.5 pb-1 text-center text-[11px] font-semibold text-[#EF4444] min-[360px]:px-4 min-[360px]:text-[12px]">
            {sendError}
          </p>
        ) : null}
        {copyToast ? (
          <p className="px-2.5 pb-1 text-center text-[11px] font-semibold text-emerald-700 min-[360px]:px-4 min-[360px]:text-[12px]">
            {copyToast}
          </p>
        ) : null}
        {user?.id && nudgePlanId ? (
          <ArrivalNudgeButton
            planId={nudgePlanId}
            currentUserId={user.id}
            planStatus={nudgePlanStatus}
            scheduledAt={nudgeScheduledAt}
            myNudgedAt={myNudgedAt}
            partnerNudgedAt={partnerNudgedAt}
            reportedUserId={nudgeReportedUserId}
          />
        ) : null}
        <SmartSuggestionsBar
          suggestions={smartSuggestions}
          onSelect={(suggestion) => {
            setText(suggestion);
            composeInputRef.current?.focus();
          }}
        />
        <ChatComposer
          preset={chatPreset}
          onOffer={onQuickSendOffer}
          onPlace={onSuggestPlace}
          placeBusy={placeBusy}
          onLiveLocation={liveLocation.onLiveLocation}
          liveLocationActive={liveLocation.liveLocationActive}
          liveLocationBusy={liveLocation.liveLocationBusy}
          showLiveLocation={liveLocation.enabled}
          liveLocationOverlays={
            liveLocation.showConsent || liveLocation.showPicker ? (
              <LiveLocationSharingOverlays
                showConsent={liveLocation.showConsent}
                showPicker={liveLocation.showPicker}
                onConsented={() => {
                  liveLocation.setHasConsent(true);
                  liveLocation.setShowConsent(false);
                  liveLocation.setShowPicker(true);
                }}
                onDeclined={() => liveLocation.setShowConsent(false)}
                onPickDuration={(m) => void liveLocation.handleStartSharing(m)}
                onClosePicker={() => liveLocation.setShowPicker(false)}
              />
            ) : null
          }
          value={text}
          onChange={handleComposerChange}
          onSend={() => void handleSend()}
          onAttach={(file) => void handleAttach(file)}
          sending={sending}
          disabled={!user?.id}
          threadLook={messageInputLook}
          composeInputRef={composeInputRef}
          placeholder={isGroupChat ? 'Message… (@ to mention)' : 'Message…'}
          onSelectionChange={handleComposerSelection}
          mentionPicker={
            isGroupChat ? (
              <GroupMentionPicker
                visible={!!activeMention && !mentionPickerSuppressed}
                members={mentionPickerMembers}
                avatarByUserId={mentionAvatarByUserId}
                onSelect={handleSelectMention}
              />
            ) : null
          }
          replyTo={
            pendingReply
              ? { senderLabel: pendingReply.senderLabel, preview: pendingReply.preview }
              : null
          }
          onCancelReply={() => setPendingReply(null)}
        />
      </div>

      <MessageActionsSheet
        open={actionsOpen}
        onClose={() => {
          setActionsOpen(false);
          setActionTarget(null);
        }}
        actions={actionTarget ? buildActionItems(actionTarget) : []}
      />

      <EditMessageDialog
        open={!!editModal}
        draft={editModal?.draft ?? ''}
        busy={editBusy}
        error={editError}
        onDraftChange={(draft) => setEditModal((e) => (e ? { ...e, draft } : e))}
        onClose={() => {
          if (editBusy) return;
          setEditModal(null);
          setEditError(null);
        }}
        onSave={() => void saveEditedMessage()}
      />

      <ConfirmDialog
        open={!!deleteForMeTarget}
        title="Delete for me?"
        message="This message will be removed from your chat. The other person can still see it."
        cancelLabel="Cancel"
        confirmLabel="Delete"
        confirmVariant="danger"
        busy={deleteBusy}
        onClose={() => {
          if (!deleteBusy) setDeleteForMeTarget(null);
        }}
        onConfirm={() => {
          if (deleteForMeTarget) void runDeleteForMe(deleteForMeTarget);
        }}
      />

      <ConfirmDialog
        open={!!deleteForEveryoneTarget}
        title="Delete for everyone?"
        message="This removes the message for you and the other person."
        cancelLabel="Cancel"
        confirmLabel="Delete"
        confirmVariant="danger"
        busy={deleteBusy}
        onClose={() => {
          if (!deleteBusy) setDeleteForEveryoneTarget(null);
        }}
        onConfirm={() => {
          if (deleteForEveryoneTarget) void runDeleteForEveryone(deleteForEveryoneTarget);
        }}
      />

      <ForwardMessageDialog
        open={forwardOpen}
        conversations={inboxRows ?? []}
        currentConversationId={conversationId}
        busy={forwardBusy}
        onClose={() => {
          setForwardOpen(false);
          setForwardTarget(null);
        }}
        onSelect={(targetId) => {
          if (!user?.id || !forwardTarget) return;
          setForwardBusy(true);
          void (async () => {
            const client = createClient();
            const { error: fwdErr } = await forwardMessageToConversation(
              client,
              forwardTarget,
              targetId,
              user.id
            );
            setForwardBusy(false);
            setForwardOpen(false);
            setForwardTarget(null);
            if (fwdErr) setSendError(fwdErr);
            else {
              setCopyToast(`Forwarded to chat`);
              window.setTimeout(() => setCopyToast(null), 2000);
              invalidateInboxQueries(queryClient, user.id);
            }
          })();
        }}
      />

      <ChatAppearanceSheet
        open={appearanceOpen}
        onClose={() => setAppearanceOpen(false)}
        value={appearance}
        onSave={(next) => {
          setAppearance(next);
          void saveChatAppearance(next);
        }}
      />

      {user?.id && (peer.otherId || isGroupChat) ? (
        <>
          <ChatSafetySheet
            open={safetyOpen}
            onClose={() => setSafetyOpen(false)}
            onReportUser={() => {
              if (isGroupChat) {
                setMemberPickerOpen(true);
              } else if (peer.otherId) {
                setReportMemberId(peer.otherId);
                setReportOpen(true);
              }
            }}
            onPlanDispute={() => {
              if (isGroupChat && peer.planId) {
                router.push(`/dispute/${peer.planId}/detail`);
              } else if (linkedMeetup) {
                router.push(`/plan/${linkedMeetup.id}`);
              } else {
                router.push('/disputes');
              }
            }}
            canPlanDispute={isGroupChat ? !!peer.planId : canOpenPlanDispute}
          />
          {memberPickerOpen ? (
            <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
              <button
                type="button"
                className="absolute inset-0"
                aria-label="Close"
                onClick={() => setMemberPickerOpen(false)}
              />
              <div className="relative w-full max-w-lg rounded-t-3xl border border-border bg-white p-5 shadow-xl sm:rounded-3xl">
                <h2 className="font-display text-lg font-extrabold">Report a member</h2>
                <p className="mt-1 text-[13px] font-semibold text-muted">Choose who to report</p>
                <ul className="mt-4 max-h-64 space-y-1 overflow-y-auto">
                  {groupMembers
                    .filter((m) => m.user_id !== user.id)
                    .map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setMemberPickerOpen(false);
                            setReportMemberId(m.user_id);
                            setReportOpen(true);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[#EDE8FF]/50"
                        >
                          <span className="font-extrabold text-foreground">
                            {m.user?.display_name ?? 'Member'}
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          ) : null}
          {reportMemberId ? (
          <ChatReportDialog
            open={reportOpen}
              onClose={() => {
                setReportOpen(false);
                setReportMemberId(null);
              }}
            reporterId={user.id}
              reportedUserId={reportMemberId}
          />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
