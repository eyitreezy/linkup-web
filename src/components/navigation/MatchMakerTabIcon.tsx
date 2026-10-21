'use client';

import { matchMakerNavIconSrc } from '@/lib/navigation/matchmakerNavIcon';
import { cn } from '@/utils/cn';
import type { CSSProperties } from 'react';

type Props = {
  size?: number;
  className?: string;
  pulse?: boolean;
  /** When set, renders supplied sidebar/bottom-nav PNG artwork (active vs inactive). */
  navActive?: boolean;
};

/** Inactive nav artwork fill — matches supplied inactive PNG. */
const NAV_INACTIVE_FILL = '#8B92A5';

/**
 * Nav PNGs use a black backdrop. Luminance masking drops the black field and paints the
 * glyph with a solid fill so inactive icons stay visible on white nav surfaces (unlike
 * mix-blend-lighten, which washes gray art out on light backgrounds).
 */
function MatchMakerNavIconImage({
  active,
  size,
  className,
  pulse,
}: {
  active: boolean;
  size: number;
  className?: string;
  pulse?: boolean;
}) {
  const src = matchMakerNavIconSrc(active);
  const maskStyle = {
    width: size,
    height: size,
    backgroundColor: active ? '#FFFFFF' : NAV_INACTIVE_FILL,
    WebkitMaskImage: `url("${src}")`,
    maskImage: `url("${src}")`,
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskMode: 'luminance',
    maskMode: 'luminance',
  } as CSSProperties;

  return (
    <span
      aria-hidden
      className={cn('inline-block shrink-0', pulse && 'animate-mm-tab-pulse', className)}
      style={maskStyle}
    />
  );
}

/** Filled heart with orbital ring — or nav PNG when `navActive` is provided. */
export function MatchMakerTabIcon({ size = 24, className, pulse, navActive }: Props) {
  if (navActive !== undefined) {
    return (
      <MatchMakerNavIconImage
        active={navActive}
        size={size}
        className={className}
        pulse={pulse}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 text-inherit', pulse && 'animate-mm-tab-pulse', className)}
      aria-hidden
    >
      <path
        d="M4.5 12.8C4.5 14.5 7.8 16 12 16C16.2 16 19.5 14.5 19.5 12.8"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeOpacity={0.35}
      />
      <path
        d="M12 19C12 19 4.5 14 4.5 8.5C4.5 6.3 6.1 4.5 8.1 4.5C9.5 4.5 10.8 5.3 12 6.5C13.2 5.3 14.5 4.5 15.9 4.5C17.9 4.5 19.5 6.3 19.5 8.5C19.5 14 12 19 12 19Z"
        fill="currentColor"
        fillOpacity={0.2}
        stroke="currentColor"
        strokeWidth={0.75}
        strokeLinejoin="round"
      />
      <path
        d="M19.5 12.8C19.5 11.1 16.2 9.6 12 9.6C7.8 9.6 4.5 11.1 4.5 12.8"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeOpacity={0.35}
      />
    </svg>
  );
}
