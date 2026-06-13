'use client';

import type { ReactNode } from 'react';

type Props = {
  title?: string;
  children?: ReactNode;
};

/** Right rail — pinned on desktop; filter content scrolls inside the rail. */
export function ContextPanel({ title = 'Sort and filter', children }: Props) {
  return (
    <aside className="hidden h-full max-h-full min-h-0 w-[300px] shrink-0 flex-col overflow-hidden border-l border-border bg-surface/80 backdrop-blur-sm xl:flex">
      <h2 className="shrink-0 px-6 pt-6 font-display text-[15px] font-extrabold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-6 pb-6 pt-4 [-webkit-overflow-scrolling:touch]">
        {children ?? (
          <div className="linkup-card space-y-3 p-4 text-[13px] font-semibold leading-relaxed text-muted">
            <p className="font-extrabold text-foreground">Trust-first discovery</p>
            <p>Verified hosts, mood filters, and escrow-backed plans — same rules as the LinkUp app.</p>
          </div>
        )}
      </div>
    </aside>
  );
}
