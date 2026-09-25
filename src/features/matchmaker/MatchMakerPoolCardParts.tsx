'use client';

import type { ReactNode } from 'react';
import { MatchMakerPrimaryButton, MatchMakerSecondaryButton } from '@/features/matchmaker/MatchMakerLayout';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { cn } from '@/utils/cn';

export function MatchMakerPoolCardSignals({
  signals,
  className,
  compact = false,
}: {
  signals: string[];
  className?: string;
  compact?: boolean;
}) {
  if (signals.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {signals.map((signal) => (
        <span
          key={signal}
          className={cn(
            'rounded-full border font-extrabold',
            compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-[12px]'
          )}
          style={{
            borderColor: MATCHMAKER_THEME.border,
            background: MATCHMAKER_THEME.surfaceWarm,
            color: MATCHMAKER_THEME.accent,
          }}
        >
          {signal}
        </span>
      ))}
    </div>
  );
}

export function MatchMakerPoolCardActions({
  onPass,
  onExpressInterest,
  expressBusy = false,
  preview = false,
  compact = false,
  className,
  interestSent = false,
  canPass = true,
  canExpress = true,
  statusLabel,
}: {
  onPass?: () => void;
  onExpressInterest?: () => void;
  expressBusy?: boolean;
  preview?: boolean;
  compact?: boolean;
  className?: string;
  interestSent?: boolean;
  canPass?: boolean;
  canExpress?: boolean;
  statusLabel?: string | null;
}) {
  if (preview) return null;

  if (statusLabel && !canExpress && !canPass) {
    return (
      <p
        className={cn(
          'rounded-full border px-3 py-2 text-center text-[12px] font-extrabold',
          compact ? 'text-[11px]' : undefined
        )}
        style={{
          borderColor: MATCHMAKER_THEME.border,
          background: MATCHMAKER_THEME.surfaceWarm,
          color: MATCHMAKER_THEME.accent,
        }}
      >
        {statusLabel}
      </p>
    );
  }

  return (
    <div className={cn(compact ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-2 gap-3', className)}>
      <MatchMakerSecondaryButton
        onClick={onPass}
        disabled={!canPass || expressBusy}
        className={compact ? 'min-h-[40px] text-[12px]' : undefined}
      >
        Pass
      </MatchMakerSecondaryButton>
      <MatchMakerPrimaryButton
        disabled={expressBusy || !canExpress || interestSent}
        onClick={onExpressInterest}
        className={compact ? 'min-h-[40px] text-[12px]' : undefined}
      >
        {expressBusy ? 'Sending…' : interestSent ? 'Interest sent' : 'Express Interest'}
      </MatchMakerPrimaryButton>
    </div>
  );
}

export function MatchMakerPoolDistancePill({
  label,
  className,
  icon,
}: {
  label: string;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white shadow-sm',
        className
      )}
      style={{ background: MATCHMAKER_THEME.ctaGradient }}
    >
      {icon}
      <span className="truncate">{label}</span>
    </span>
  );
}
