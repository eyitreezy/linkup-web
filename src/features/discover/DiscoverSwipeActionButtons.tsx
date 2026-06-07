'use client';

import { cn } from '@/utils/cn';
import { IoClose, IoFlash, IoInformationCircleOutline } from 'react-icons/io5';

type Props = {
  onPass: () => void;
  onLike: () => void;
  onInfo: () => void;
  disabled?: boolean;
};

export function DiscoverSwipeActionButtons({ onPass, onLike, onInfo, disabled }: Props) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center gap-6 px-4 py-2 max-lg:pb-[var(--linkup-bottom-nav-offset)] lg:pb-0',
        disabled && 'pointer-events-none opacity-40'
      )}
    >
      <button
        type="button"
        onClick={onPass}
        disabled={disabled}
        aria-label="Pass"
        className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#4B5563] text-white shadow-[0_6px_20px_rgba(75,85,99,0.35)] transition active:scale-90"
      >
        <IoClose size={30} />
      </button>
      <button
        type="button"
        onClick={onInfo}
        disabled={disabled}
        aria-label="Open details"
        className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/25 bg-white text-primary shadow-md transition active:scale-90"
      >
        <IoInformationCircleOutline size={26} />
      </button>
      <button
        type="button"
        onClick={onLike}
        disabled={disabled}
        aria-label="Into it — open meetup"
        className="relative flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-full linkup-gradient-primary text-white shadow-[0_8px_24px_rgba(255,101,132,0.4)] transition active:scale-90"
      >
        <span className="text-[28px] leading-none" aria-hidden>
          ♥
        </span>
        <span className="absolute right-1 top-1 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-white bg-white text-primary">
          <IoFlash size={13} />
        </span>
      </button>
    </div>
  );
}
