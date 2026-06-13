'use client';

import { TabPageHeader } from '@/components/layout/TabPageHeader';
import { NotificationBadge } from '@/components/notifications/NotificationBadge';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { useMessagesInboxOptional } from '@/contexts/MessagesInboxContext';
import { ChatThread } from '@/features/messages/ChatThread';
import { GroupAvatarCell } from '@/features/messages/GroupAvatarCell';
import { useIsMobileShellLayout } from '@/hooks/use-media-query';
import { useInboxQuery } from '@/lib/messaging/useInboxQuery';
import { formatRelativeShort } from '@/lib/messaging/formatRelative';
import type { InboxRow } from '@/services/messages.service';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/utils/cn';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';
import {
  IoChatbubbles,
  IoCheckmarkCircle,
  IoChevronBack,
  IoChevronForward,
  IoFlashOutline,
  IoHeartOutline,
  IoShieldCheckmarkOutline,
} from 'react-icons/io5';

function Avatar({ url, name, ring, compact }: { url: string | null; name: string; ring?: boolean; compact?: boolean }) {
  const initial = name.charAt(0).toUpperCase();
  const size = compact ? 'h-[50px] w-[50px] text-[15px]' : 'h-[58px] w-[58px] text-[17px]';
  const inner = url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={cn(size, 'rounded-full object-cover')} />
  ) : (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-[#EDE8FF] font-extrabold text-primary',
        size
      )}
    >
      {initial}
    </div>
  );
  if (ring) {
    return <div className="rounded-full p-0.5 ring-2 ring-secondary">{inner}</div>;
  }
  return inner;
}

function ConversationList({
  rows,
  selectedId,
  onSelect,
  loading,
  settledEmpty,
  compact,
}: {
  rows: InboxRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  settledEmpty: boolean;
  compact?: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2 p-2.5 min-[360px]:p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[80px] min-[360px]:h-[88px] animate-pulse rounded-[22px] bg-[#EDE8FF]/80" />
        ))}
      </div>
    );
  }

  if (settledEmpty) {
    return (
      <AppEmptyState
        variant="compact"
        emoji="💌"
        title="Your inbox is quiet"
        titleAccent="quiet"
        description="When you match on a meetup or say hello, conversations land here."
        tips={[
          {
            icon: IoHeartOutline,
            text: 'Open a plan you like and send an offer or message',
            iconBgClassName: 'bg-primary/10',
          },
          {
            icon: IoFlashOutline,
            text: 'Use Active filters when you have plans in motion',
            iconBgClassName: 'bg-secondary/10',
            iconClassName: 'text-secondary',
          },
          {
            icon: IoShieldCheckmarkOutline,
            text: 'Meet in public first — trust builds over time',
            iconBgClassName: 'bg-emerald-500/10',
            iconClassName: 'text-emerald-600',
          },
        ]}
        tipsLabel="Easy wins"
        action={{ label: 'Discover nearby', href: '/discover' }}
        className="border-0 bg-transparent shadow-none"
      />
    );
  }

  return (
    <ul className="space-y-2 p-2.5 min-[360px]:p-3">
      {rows.map((row) => {
        const active = row.id === selectedId;
        return (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onSelect(row.id)}
              className={cn(
                'group relative w-full overflow-hidden rounded-[20px] border text-left transition min-[360px]:rounded-[22px]',
                'shadow-[0_6px_14px_rgba(108,99,255,0.1)]',
                active
                  ? 'border-primary/50 bg-white shadow-[0_8px_20px_rgba(108,99,255,0.18)] ring-1 ring-primary/25'
                  : row.unread
                    ? 'border-secondary/40 bg-white hover:border-secondary/55'
                    : 'border-primary/10 bg-white/95 hover:border-primary/25 hover:bg-white'
              )}
            >
              {row.unread && !active ? (
                <div
                  className="absolute bottom-0 left-0 top-0 w-[5px] rounded-l-[20px] bg-gradient-to-b from-secondary to-primary min-[360px]:rounded-l-[22px]"
                  aria-hidden
                />
              ) : null}
              {active ? (
                <div
                  className="absolute bottom-0 left-0 top-0 w-[5px] rounded-l-[20px] linkup-gradient-primary min-[360px]:rounded-l-[22px]"
                  aria-hidden
                />
              ) : null}
              <div className="flex items-center gap-2.5 py-3 pl-3.5 pr-2.5 min-[360px]:gap-3 min-[360px]:py-3.5 min-[360px]:pl-4 min-[360px]:pr-3">
                {row.isGroupChat ? (
                  <GroupAvatarCell
                    avatarUrl={row.groupAvatarUrl}
                    groupName={row.name}
                    memberPreviews={row.memberPreviews}
                    compact={compact}
                  />
                ) : (
                  <Avatar url={row.avatarUrl} name={row.name} ring={row.unread || active} compact={compact} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2 min-[360px]:mb-1.5">
                    <span className="flex min-w-0 items-center gap-1 truncate text-[16px] font-extrabold tracking-tight text-foreground min-[360px]:text-[17px]">
                      {row.name}
                      {!row.isGroupChat && row.verified ? (
                        <IoCheckmarkCircle className="shrink-0 text-primary" size={16} aria-label="Verified" />
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 text-[11px] font-bold tabular-nums min-[360px]:text-[12px]',
                        row.unread || active ? 'text-secondary' : 'text-muted'
                      )}
                    >
                      {formatRelativeShort(row.timeIso)}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {row.isGroupChat && row.memberCount ? (
                        <p className="mb-0.5 text-[12px] font-semibold text-muted">
                          {row.memberCount} members
                        </p>
                      ) : null}
                      <p
                        className={cn(
                          'line-clamp-2 text-[14px] leading-snug min-[360px]:text-[15px]',
                          row.unread ? 'font-bold text-foreground' : 'font-medium text-muted'
                        )}
                      >
                        {row.preview}
                      </p>
                    </div>
                    {row.unread ? (
                      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-secondary" />
                    ) : null}
                  </div>
                </div>
                <IoChevronForward
                  size={18}
                  className={cn(
                    'shrink-0 transition',
                    active || row.unread ? 'text-secondary opacity-95' : 'text-muted opacity-40 group-hover:opacity-70'
                  )}
                  aria-hidden
                />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function InboxHeader({ unreadTotal, isMobile }: { unreadTotal: number; isMobile: boolean }) {
  return (
    <div
      className={cn(
        'relative z-10 shrink-0 border-b border-border/80 bg-white/90 backdrop-blur-md',
        isMobile ? 'px-2.5 py-2 min-[360px]:px-3 min-[360px]:py-2.5' : 'px-4 py-3 min-[360px]:px-5 min-[360px]:py-4'
      )}
    >
      <TabPageHeader
        kicker="Your inbox"
        title="Chats"
        description={
          isMobile
            ? undefined
            : 'Straightforward chats with people you&apos;re connecting with — synced with the app.'
        }
        icon={<IoChatbubbles size={22} />}
        trailing={
          unreadTotal > 0 ? (
            <NotificationBadge
              count={unreadTotal}
              variant="pill"
              ariaLabel={`${unreadTotal > 99 ? '99+' : unreadTotal} unread chats`}
            />
          ) : null
        }
        className={cn(isMobile && '!gap-2 [&_h1]:!text-xl min-[360px]:[&_h1]:!text-2xl')}
      />
    </div>
  );
}

export function MessagesInbox() {
  const authLoading = useAuthStore((s) => s.loading);
  const userId = useAuthStore((s) => s.user?.id);
  const searchParams = useSearchParams();
  const router = useRouter();
  const isMobile = useIsMobileShellLayout();
  const selectedId = searchParams.get('c');
  const messagesInbox = useMessagesInboxOptional();
  const autoSelectedRef = useRef(false);

  const { data, isPending, isFetching, isSuccess, isError, error, refetch } = useInboxQuery();

  const rows = useMemo(() => data?.rows ?? [], [data?.rows]);
  const unreadTotal = messagesInbox?.unreadCount ?? rows.filter((r) => r.unread).length;
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const showInbox = !isMobile || !selectedId;
  const showChat = !!selectedId;

  const inboxLoading = authLoading || !userId || (isPending && rows.length === 0);
  const settledEmpty = isSuccess && !isFetching && rows.length === 0;

  useEffect(() => {
    autoSelectedRef.current = false;
  }, [userId]);

  useEffect(() => {
    if (isMobile || autoSelectedRef.current || inboxLoading || rows.length === 0 || selectedId) return;
    autoSelectedRef.current = true;
    router.replace(`/messages?c=${rows[0].id}`, { scroll: false });
  }, [isMobile, inboxLoading, rows, selectedId, router]);

  function selectConversation(id: string) {
    router.push(`/messages?c=${id}`, { scroll: false });
  }

  function backToInbox() {
    router.push('/messages', { scroll: false });
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#EDE8FF] via-[#FFF5F8] to-[#E8FAF4] opacity-90"
        aria-hidden
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {showInbox ? (
          <div
            className={cn(
              'relative flex min-h-0 flex-col bg-surface/50',
              isMobile ? 'h-full min-h-0 flex-1' : 'h-full w-full shrink-0 md:w-[340px] lg:w-[380px] lg:border-r lg:border-border'
            )}
          >
            <InboxHeader unreadTotal={unreadTotal} isMobile={isMobile} />
            {isError ? (
              <p className="relative z-10 px-3 py-2 text-[13px] font-semibold text-[#EF4444]">
                {error instanceof Error ? error.message : 'Could not load inbox'}
                <button
                  type="button"
                  className="ml-2 font-extrabold text-primary underline"
                  onClick={() => void refetch()}
                >
                  Retry
                </button>
              </p>
            ) : null}
            <div
              className={cn(
                'relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain',
                isMobile && 'pb-[var(--linkup-tab-clearance)]'
              )}
            >
              <ConversationList
                rows={rows}
                selectedId={selectedId}
                onSelect={selectConversation}
                loading={inboxLoading}
                settledEmpty={settledEmpty}
                compact={isMobile}
              />
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            'relative flex min-h-0 flex-1 flex-col bg-surface',
            !isMobile && 'min-w-0',
            isMobile ? (showChat ? 'flex h-full' : 'hidden') : selectedId ? 'flex' : 'hidden lg:flex'
          )}
        >
          {selectedId && selected ? (
            <ChatThread
              conversationId={selectedId}
              peer={selected}
              onBack={isMobile ? backToInbox : undefined}
            />
          ) : selectedId && inboxLoading ? (
            <div className="flex flex-1 flex-col">
              {isMobile ? (
                <button
                  type="button"
                  onClick={backToInbox}
                  className="flex items-center gap-1 border-b border-border px-3 py-2.5 text-[14px] font-extrabold text-primary"
                >
                  <IoChevronBack size={22} />
                  Inbox
                </button>
              ) : null}
              <p className="flex flex-1 items-center justify-center p-8 text-[14px] font-semibold text-muted">
                Loading conversation…
              </p>
            </div>
          ) : selectedId && !inboxLoading ? (
            <div className="flex flex-1 flex-col">
              {isMobile ? (
                <button
                  type="button"
                  onClick={backToInbox}
                  className="flex items-center gap-1 border-b border-border px-3 py-2.5 text-[14px] font-extrabold text-primary"
                >
                  <IoChevronBack size={22} />
                  Inbox
                </button>
              ) : null}
              <p className="flex flex-1 items-center justify-center p-8 text-center text-[14px] font-semibold text-muted">
                This conversation could not be found.
              </p>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div className="max-w-xs space-y-2">
                <p className="text-4xl" aria-hidden>
                  💬
                </p>
                <p className="font-display text-lg font-extrabold text-foreground">Select a conversation</p>
                <p className="text-[14px] font-semibold text-muted">
                  Pick someone from your inbox to continue the thread.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
