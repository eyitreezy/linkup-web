'use client';

import { IoChevronDown, IoChevronUp, IoClose } from 'react-icons/io5';

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  onCancel: () => void;
  resultCount?: number;
  currentIndex?: number;
  onPrevResult: () => void;
  onNextResult: () => void;
  searching?: boolean;
};

export function ChatSearchBar({
  query,
  onQueryChange,
  onCancel,
  resultCount = 0,
  currentIndex = 0,
  onPrevResult,
  onNextResult,
  searching,
}: Props) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search messages"
          autoFocus
          className="min-w-0 flex-1 rounded-xl border border-border bg-white px-3 py-2 text-[14px] font-semibold text-foreground outline-none focus:border-primary"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            className="rounded-full p-1.5 text-muted transition hover:bg-[#F5F6FA]"
            aria-label="Clear search"
          >
            <IoClose size={18} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 text-[14px] font-extrabold text-muted transition hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      {searching ? (
        <p className="text-[12px] font-semibold text-muted">Searching…</p>
      ) : resultCount > 0 ? (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onPrevResult}
            className="rounded-full p-1 text-muted transition hover:bg-[#F5F6FA]"
            aria-label="Previous result"
          >
            <IoChevronUp size={18} />
          </button>
          <span className="text-[12px] font-semibold text-muted tabular-nums">
            {currentIndex + 1} of {resultCount} matches
          </span>
          <button
            type="button"
            onClick={onNextResult}
            className="rounded-full p-1 text-muted transition hover:bg-[#F5F6FA]"
            aria-label="Next result"
          >
            <IoChevronDown size={18} />
          </button>
        </div>
      ) : query.trim().length >= 2 ? (
        <p className="text-center text-[12px] font-semibold text-muted">No matches</p>
      ) : null}
    </div>
  );
}
