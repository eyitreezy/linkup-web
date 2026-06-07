'use client';

import { AvatarWithPresence } from '@/components/presence/AvatarWithPresence';
import { usePresence } from '@/contexts/PresenceContext';
import { ChatAppearanceSheet } from '@/features/messages/ChatAppearanceSheet';
import { ChatMessageBubble } from '@/features/messages/ChatMessageBubble';
import { ChatReportDialog } from '@/features/messages/ChatReportDialog';
import { ChatSafetySheet } from '@/features/messages/ChatSafetySheet';
import { ChatComposer } from '@/features/messages/ChatComposer';
import { ChatTypingIndicator } from '@/features/messages/ChatTypingIndicator';
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
import { setConversationLastRead } from '@/lib/messaging/inboxCache';
import { approxReadByMessageId } from '@/lib/messaging/readReceipts';
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
  sendMediaMessage,
  sendTextMessage,
  subscribeToMessages,
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
  IoSparkles,
} from 'react-icons/io5';

type Props = {
  conversationId: string;
  peer: InboxRow;
  /** Mobile: back to inbox (matches app chat header). */
  onBack?: () => void;
};

export function ChatThread({ conversationId, peer, onBack }: Props) {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const isMobile = useIsMobileShellLayout();
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { signalTyping, clearTyping } = usePresence();

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [peerPresence, setPeerPresence] = useState<DbUserPresence | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const peerPresenceRef = useRef(peerPresence);
  const [linkedMeetup, setLinkedMeetup] = useState<LinkedMeetup | null>(null);
  const [appearance, setAppearance] = useState<ChatAppearanceState>(DEFAULT_CHAT_APPEARANCE);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [placeBusy, setPlaceBusy] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

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
    enabled: !!peer.otherId,
  });

  useEffect(() => {
    void loadChatAppearance().then(setAppearance);
  }, []);

  useEffect(() => {
    if (!user?.id || !peer.otherId) return;
    void fetchActiveMeetupWithPeer(user.id, peer.otherId).then(setLinkedMeetup);
  }, [user?.id, peer.otherId]);

  useEffect(() => {
    if (!peer.otherId) return;
    let cancelled = false;
    void fetchUserPresence(peer.otherId).then((row) => {
      if (!cancelled) setPeerPresence(row);
    });
    const unsub = subscribeUserPresenceRealtime(peer.otherId, (row) => setPeerPresence(row));
    return () => {
      cancelled = true;
      unsub();
    };
  }, [peer.otherId]);

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

  const showTypingIndicator = peerTyping && typingVisibleToViewer(viewerProfile, peerProfile?.preferences);
  const readReceiptsOn = getVisibilityPrefs(viewerProfile).read_receipts;

  const { data: messages, isLoading, error } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const client = createClient();
      const { data, error: err } = await fetchMessages(client, conversationId);
      if (err) throw new Error(String(err));
      return data ?? [];
    },
    enabled: !!conversationId,
  });

  const approxRead = useMemo(
    () => approxReadByMessageId(messages ?? [], user?.id),
    [messages, user?.id]
  );

  const canOpenPlanDispute = useMemo(
    () =>
      !!linkedMeetup &&
      ['agreed', 'awaiting_payment', 'active', 'completed'].includes(linkedMeetup.status),
    [linkedMeetup]
  );

  const markRead = useCallback(() => {
    const list = messages ?? [];
    const last = list[list.length - 1];
    if (last?.created_at) {
      setConversationLastRead(conversationId, last.created_at);
      invalidateInboxQueries(queryClient, user?.id);
    }
  }, [conversationId, messages, queryClient, user?.id]);

  useEffect(() => {
    const client = createClient();
    const sub = subscribeToMessages(client, conversationId, () => {
      void queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      invalidateInboxQueries(queryClient, user?.id);
    });
    return () => {
      void client.removeChannel(sub);
    };
  }, [conversationId, queryClient, user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, showTypingIndicator]);

  useEffect(() => {
    if (messages?.length) markRead();
  }, [messages, markRead]);

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
    const { error: err } = await sendTextMessage(client, conversationId, user.id, text);
    setSending(false);
    clearTyping();
    if (err) {
      setSendError(err);
      return;
    }
    setText('');
    void queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
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
    void queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
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
        <div className="flex min-w-0 flex-1 items-center gap-2.5 min-[360px]:gap-3">
          <AvatarWithPresence
            uri={peer.avatarUrl}
            name={peer.name}
            size={44}
            presence={headerPresence}
            showDot
          />
          <div className="min-w-0 flex-1">
            {peer.otherId ? (
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
                {peer.verified ? (
                  <IoCheckmarkCircle className="shrink-0 text-primary" size={17} aria-label="Verified" />
                ) : null}
              </div>
            )}
            {linkedMeetup ? (
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
            )}
          </div>
        </div>
        {user?.id && peer.otherId ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setAppearanceOpen(true)}
              className="rounded-full p-2 text-muted transition hover:bg-[#F5F6FA]"
              aria-label="Chat appearance"
            >
              <IoColorPaletteOutline size={22} />
            </button>
            <button
              type="button"
              onClick={() => setSafetyOpen(true)}
              className="rounded-full p-2 text-muted transition hover:bg-[#F5F6FA]"
              aria-label="Safety and report"
            >
              <IoEllipsisHorizontal size={22} />
            </button>
          </div>
        ) : null}
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
            {(messages ?? []).map((m) => {
              const mine = m.sender_id === user?.id;
              const showRead = mine && readReceiptsOn && (approxRead.get(m.id) ?? false);
              return (
                <ChatMessageBubble
                  key={m.id}
                  message={m}
                  mine={mine}
                  theme={bubbleTheme}
                  compact={isMobile}
                  meta={{
                    timeLabel: formatMessageTime(m.created_at),
                    showSent: mine && readReceiptsOn,
                    showRead,
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
        <ChatComposer
          preset={chatPreset}
          onOffer={onQuickSendOffer}
          onPlace={onSuggestPlace}
          placeBusy={placeBusy}
          value={text}
          onChange={(v) => {
            setText(v);
            if (conversationId && v.trim().length > 0) signalTyping(conversationId);
          }}
          onSend={() => void handleSend()}
          onAttach={(file) => void handleAttach(file)}
          sending={sending}
          disabled={!user?.id}
          threadLook={messageInputLook}
        />
      </div>

      <ChatAppearanceSheet
        open={appearanceOpen}
        onClose={() => setAppearanceOpen(false)}
        value={appearance}
        onSave={(next) => {
          setAppearance(next);
          void saveChatAppearance(next);
        }}
      />

      {user?.id && peer.otherId ? (
        <>
          <ChatSafetySheet
            open={safetyOpen}
            onClose={() => setSafetyOpen(false)}
            onReportUser={() => setReportOpen(true)}
            onPlanDispute={() => {
              if (linkedMeetup) router.push(`/plan/${linkedMeetup.id}`);
              else router.push('/disputes');
            }}
            canPlanDispute={canOpenPlanDispute}
          />
          <ChatReportDialog
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            reporterId={user.id}
            reportedUserId={peer.otherId}
          />
        </>
      ) : null}
    </div>
  );
}
