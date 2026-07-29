'use client';

import { cn } from '@/utils/cn';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';

type Props = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  busy?: boolean;
};

export function AppPagination({ page, totalPages, onPageChange, className, busy }: Props) {
  if (totalPages <= 1) return null;

  const canPrev = page > 0;
  const canNext = page < totalPages - 1;

  const pageNumbers = getCompactPageNumbers(page, totalPages);

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        'flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border/70 bg-white/90 px-3 py-3 shadow-sm',
        className
      )}
    >
      <button
        type="button"
        disabled={!canPrev || busy}
        onClick={() => onPageChange(page - 1)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted transition hover:border-primary/25 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Previous page"
      >
        <IoChevronBack size={18} />
      </button>

      <div className="flex flex-wrap items-center justify-center gap-1">
        {pageNumbers.map((item, index) =>
          item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="px-1 text-[13px] font-semibold text-muted">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              disabled={busy}
              onClick={() => onPageChange(item)}
              aria-current={item === page ? 'page' : undefined}
              className={cn(
                'inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-xl px-2 text-[13px] font-extrabold transition',
                item === page
                  ? 'linkup-gradient-primary text-white shadow-sm'
                  : 'border border-border text-muted hover:border-primary/25 hover:text-primary'
              )}
            >
              {item + 1}
            </button>
          )
        )}
      </div>

      <button
        type="button"
        disabled={!canNext || busy}
        onClick={() => onPageChange(page + 1)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted transition hover:border-primary/25 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Next page"
      >
        <IoChevronForward size={18} />
      </button>
    </nav>
  );
}

function getCompactPageNumbers(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i);
  }

  const items: (number | 'ellipsis')[] = [0];

  if (page > 2) items.push('ellipsis');

  const start = Math.max(1, page - 1);
  const end = Math.min(totalPages - 2, page + 1);
  for (let i = start; i <= end; i += 1) {
    items.push(i);
  }

  if (page < totalPages - 3) items.push('ellipsis');

  items.push(totalPages - 1);
  return items;
}
