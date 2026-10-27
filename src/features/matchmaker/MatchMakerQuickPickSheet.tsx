'use client';

import {
  CONVERSATION_STARTER_CATEGORIES,
  type ConversationStarterCategoryId,
  pickQuickPickBatch,
  sharedPublicInterests,
} from '@/lib/matchmaker/conversationStarters';
import type { ProfilePreferences } from '@/types/database';
import { cn } from '@/utils/cn';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IoClose, IoRefresh } from 'react-icons/io5';

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (text: string) => void;
  viewerPreferences?: ProfilePreferences | null;
  peerPreferences?: ProfilePreferences | null;
};

export function MatchMakerQuickPickSheet({
  open,
  onClose,
  onSelect,
  viewerPreferences,
  peerPreferences,
}: Props) {
  const [categoryId, setCategoryId] = useState<ConversationStarterCategoryId>('easy_icebreakers');
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [interestIndex, setInterestIndex] = useState(0);
  const shownInSessionRef = useRef<Set<string>>(new Set());

  const sharedInterests = useMemo(
    () => sharedPublicInterests(viewerPreferences, peerPreferences),
    [viewerPreferences, peerPreferences]
  );

  const activeSharedInterest = useMemo(() => {
    if (sharedInterests.length === 0) return null;
    const idx = interestIndex % sharedInterests.length;
    return sharedInterests[idx] ?? null;
  }, [sharedInterests, interestIndex]);

  const suggestions = useMemo(() => {
    if (!open) return [];
    return pickQuickPickBatch({
      categoryId,
      sharedInterest: categoryId === 'shared_interests' ? activeSharedInterest : null,
      refreshIndex,
      excludeTexts: shownInSessionRef.current,
    });
  }, [open, categoryId, activeSharedInterest, refreshIndex]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      shownInSessionRef.current = new Set();
      setRefreshIndex(0);
      setInterestIndex(0);
      setCategoryId('easy_icebreakers');
    }
  }, [open]);

  const handleShowMore = useCallback(() => {
    suggestions.forEach((s) => shownInSessionRef.current.add(s));
    setRefreshIndex((n) => n + 1);
    if (categoryId === 'shared_interests' && sharedInterests.length > 1) {
      setInterestIndex((n) => n + 1);
    }
  }, [suggestions, categoryId, sharedInterests.length]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div
        className="relative flex max-h-[min(85vh,640px)] w-full max-w-lg flex-col rounded-t-3xl border border-border bg-white shadow-xl sm:rounded-3xl"
        role="dialog"
        aria-labelledby="mm-quick-pick-title"
      >
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" aria-hidden />
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-4 pb-3 pt-4 sm:px-5">
          <div className="min-w-0">
            <h2 id="mm-quick-pick-title" className="font-display text-xl font-extrabold text-foreground">
              Start a conversation
            </h2>
            <p className="mt-1 text-[13px] font-semibold leading-relaxed text-muted">
              Pick a starter to add to your message. You can edit it before you send.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-muted hover:bg-[#F5F6FA]"
            aria-label="Close"
          >
            <IoClose size={22} />
          </button>
        </div>

        <div
          className="flex shrink-0 gap-2 overflow-x-auto border-b border-border/60 px-4 py-3 scrollbar-none sm:px-5"
          role="tablist"
          aria-label="Conversation starter categories"
        >
          {CONVERSATION_STARTER_CATEGORIES.map((cat) => {
            const selected = cat.id === categoryId;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setCategoryId(cat.id)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-extrabold transition',
                  selected
                    ? 'border-primary bg-[#EDE8FF] text-primary'
                    : 'border-border bg-white text-muted hover:border-primary/30'
                )}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5" aria-label="Suggested conversation starters">
          {categoryId === 'shared_interests' && sharedInterests.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-border px-4 py-3 text-[13px] font-semibold text-muted">
              We could not find shared interests on your public profiles yet. These openers work without naming a
              specific hobby.
            </li>
          ) : null}
          {suggestions.map((line) => (
            <li key={line} className="mb-2 last:mb-0">
              <button
                type="button"
                onClick={() => {
                  shownInSessionRef.current.add(line);
                  onSelect(line);
                }}
                className="w-full rounded-2xl border border-border px-4 py-3 text-left text-[14px] font-semibold leading-snug text-foreground transition hover:border-primary/40 hover:bg-[#EDE8FF]/35"
              >
                {line}
              </button>
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={handleShowMore}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-[13px] font-extrabold text-muted transition hover:border-primary/30 hover:text-foreground"
          >
            <IoRefresh size={16} aria-hidden />
            Show more
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-[13px] font-extrabold text-muted hover:bg-[#F5F6FA]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
