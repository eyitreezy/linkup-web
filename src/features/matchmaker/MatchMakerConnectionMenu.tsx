'use client';

import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { cn } from '@/utils/cn';
import { useEffect, useRef, useState } from 'react';
import { IoEllipsisHorizontal, IoSettingsOutline } from 'react-icons/io5';
import Link from 'next/link';

type Props = {
  onReport: () => void;
};

export function MatchMakerConnectionMenu({ onReport }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Connection options"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-2xl border bg-white/90 shadow-sm"
        style={{ borderColor: `${MATCHMAKER_THEME.accent}33`, color: MATCHMAKER_THEME.textMuted }}
      >
        <IoEllipsisHorizontal size={22} />
      </button>

      {open ? (
        <div
          className={cn(
            'absolute right-0 top-full z-20 mt-2 min-w-[220px] overflow-hidden rounded-2xl border bg-white py-1 shadow-lg'
          )}
          style={{ borderColor: MATCHMAKER_THEME.border }}
        >
          <Link
            href="/matchmaker/settings"
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-[14px] font-semibold hover:bg-[#FBF5F0]"
            onClick={() => setOpen(false)}
          >
            <IoSettingsOutline size={18} />
            MatchMaker settings
          </Link>
          <button
            type="button"
            className="flex w-full px-4 py-3 text-left text-[14px] font-semibold hover:bg-[#FBF5F0]"
            onClick={() => {
              setOpen(false);
              onReport();
            }}
          >
            Report this connection
          </button>
        </div>
      ) : null}
    </div>
  );
}
