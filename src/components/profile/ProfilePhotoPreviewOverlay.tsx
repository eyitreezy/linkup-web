'use client';

import { cn } from '@/utils/cn';
import { useEffect } from 'react';
import { IoChevronBack, IoChevronForward, IoClose } from 'react-icons/io5';

type Props = {
  open: boolean;
  uris: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

export function ProfilePhotoPreviewOverlay({ open, uris, index, onIndexChange, onClose }: Props) {
  const safeIndex = uris.length > 0 ? Math.min(Math.max(index, 0), uris.length - 1) : 0;

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && uris.length > 1) {
        onIndexChange(safeIndex <= 0 ? uris.length - 1 : safeIndex - 1);
      }
      if (e.key === 'ArrowRight' && uris.length > 1) {
        onIndexChange(safeIndex >= uris.length - 1 ? 0 : safeIndex + 1);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [safeIndex, onClose, onIndexChange, open, uris.length]);

  if (!open || uris.length === 0) return null;

  const uri = uris[safeIndex];
  if (!uri) return null;
  const showNav = uris.filter(Boolean).length > 1;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-[rgba(8,10,18,0.94)]"
      role="dialog"
      aria-modal="true"
      aria-label="Photo preview"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-zoom-out"
        aria-label="Close preview"
        onClick={onClose}
      />

      <div className="relative z-10 flex items-center justify-between px-4 pb-2 pt-4 sm:pt-6">
        {showNav ? (
          <p className="text-[14px] font-extrabold text-white/90">
            {safeIndex + 1} / {uris.length}
          </p>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
          aria-label="Close preview"
        >
          <IoClose size={22} />
        </button>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-3 pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={uri} alt="" className="max-h-[72vh] max-w-full object-contain" />

        {showNav ? (
          <>
            <button
              type="button"
              onClick={() => onIndexChange(safeIndex <= 0 ? uris.length - 1 : safeIndex - 1)}
              className={cn(
                'absolute left-2 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full',
                'border border-white/20 bg-white/10 text-white transition hover:bg-white/20'
              )}
              aria-label="Previous photo"
            >
              <IoChevronBack size={24} />
            </button>
            <button
              type="button"
              onClick={() => onIndexChange(safeIndex >= uris.length - 1 ? 0 : safeIndex + 1)}
              className={cn(
                'absolute right-2 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full',
                'border border-white/20 bg-white/10 text-white transition hover:bg-white/20'
              )}
              aria-label="Next photo"
            >
              <IoChevronForward size={24} />
            </button>
          </>
        ) : null}
      </div>

      <p className="relative z-10 pb-4 text-center text-[12px] font-semibold text-white/55">
        Double-click a thumbnail to preview · Esc to close
      </p>
    </div>
  );
}
