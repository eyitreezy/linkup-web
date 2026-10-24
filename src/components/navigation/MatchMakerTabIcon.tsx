'use client';

import {
  matchMakerIconArtwork,
  matchMakerIconBackground,
  matchMakerIconOpacityClass,
  matchMakerIconToneFromNavActive,
  type MatchMakerIconTone,
} from '@/lib/matchmaker/iconColors';
import { matchMakerNavIconSrc } from '@/lib/navigation/matchmakerNavIcon';
import { cn } from '@/utils/cn';
import type { CSSProperties } from 'react';

type Props = {
  size?: number;
  className?: string;
  pulse?: boolean;
  /** Main nav only — maps to nav-active / nav-inactive tones. */
  navActive?: boolean;
  /** In-app and nav coloring; defaults to `accent` when navActive is omitted. */
  tone?: MatchMakerIconTone;
};

function MatchMakerBrandIconImage({
  tone,
  size,
  className,
  pulse,
}: {
  tone: MatchMakerIconTone;
  size: number;
  className?: string;
  pulse?: boolean;
}) {
  const artworkActive = matchMakerIconArtwork(tone) === 'active';
  const src = matchMakerNavIconSrc(artworkActive);
  const opacityClass = matchMakerIconOpacityClass(tone);

  const maskStyle = {
    width: size,
    height: size,
    background: matchMakerIconBackground(tone),
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
      className={cn(
        'inline-block shrink-0',
        opacityClass,
        pulse && 'animate-mm-tab-pulse',
        className
      )}
      style={maskStyle}
    />
  );
}

/** MatchMaker heart-ring artwork — PNG mask with spec icon color tones. */
export function MatchMakerTabIcon({
  size = 24,
  className,
  pulse,
  navActive,
  tone,
}: Props) {
  const resolvedTone: MatchMakerIconTone =
    navActive !== undefined
      ? matchMakerIconToneFromNavActive(navActive)
      : (tone ?? 'accent');

  return (
    <MatchMakerBrandIconImage
      tone={resolvedTone}
      size={size}
      className={className}
      pulse={pulse}
    />
  );
}
