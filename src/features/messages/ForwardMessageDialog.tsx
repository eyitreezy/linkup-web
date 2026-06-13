'use client';

import { AvatarWithPresence } from '@/components/presence/AvatarWithPresence';
import type { InboxRow } from '@/services/messages.service';
import { IoCheckmarkCircle } from 'react-icons/io5';

type Props = {
  open: boolean;
  conversations: InboxRow[];
  currentConversationId: string;
  busy?: boolean;
  onClose: () => void;
  onSelect: (conversationId: string) => void;
};

export function ForwardMessageDialog({
  open,
  conversations,
  currentConversationId,
  busy,
  onClose,
  onSelect,
}: Props) {
  if (!open) return null;

  const targets = conversations.filter((c) => c.id !== currentConversationId);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm min-[425px]:items-center min-[425px]:p-4"
      onClick={onClose}
    >
      <div
        className="linkup-card max-h-[70vh] w-full max-w-md overflow-hidden rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-5 py-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-secondary">Forward</p>
          <h2 className="font-display text-lg font-extrabold text-foreground">Choose a chat</h2>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto divide-y divide-border/60">
          {targets.length === 0 ? (
            <li className="px-5 py-8 text-center text-[14px] font-semibold text-muted">
              No other conversations yet.
            </li>
          ) : (
            targets.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSelect(row.id)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-[#F8F7FF] disabled:opacity-50"
                >
                  <AvatarWithPresence
                    uri={row.avatarUrl}
                    name={row.name}
                    size={40}
                    presence={null}
                    showDot={false}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="truncate font-extrabold text-foreground">{row.name}</span>
                      {row.verified ? (
                        <IoCheckmarkCircle className="shrink-0 text-primary" size={14} />
                      ) : null}
                    </div>
                    <p className="truncate text-[12px] font-semibold text-muted">{row.preview}</p>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="w-full border-t border-border py-3 text-[14px] font-extrabold text-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
