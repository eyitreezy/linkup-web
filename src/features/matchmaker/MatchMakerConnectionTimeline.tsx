'use client';

import type { ConnectionMilestone } from '@/lib/matchmaker/connectionTimeline';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { IoCheckmark } from 'react-icons/io5';

export function MatchMakerConnectionTimeline({ milestones }: { milestones: ConnectionMilestone[] }) {
  return (
    <ol className="mt-2 space-y-0">
      {milestones.map((m, index) => {
        const isLast = index === milestones.length - 1;
        return (
          <li key={m.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <MilestoneDot state={m.state} />
              {!isLast ? (
                <div
                  className="my-1 w-0.5 flex-1 min-h-[20px]"
                  style={{
                    background:
                      m.state === 'completed' ? MATCHMAKER_THEME.primary : MATCHMAKER_THEME.disabled,
                  }}
                />
              ) : null}
            </div>
            <div className={cnRow(isLast)}>
              <p
                className="text-[14px] font-extrabold"
                style={{
                  color:
                    m.state === 'future' ? MATCHMAKER_THEME.disabled : MATCHMAKER_THEME.textPrimary,
                }}
              >
                {m.label}
              </p>
              {m.detail ? (
                <p className="text-[12px] font-semibold" style={{ color: MATCHMAKER_THEME.textMuted }}>
                  {m.detail}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function cnRow(isLast: boolean): string {
  return isLast ? 'pb-0 pt-0.5' : 'pb-4 pt-0.5';
}

function MilestoneDot({ state }: { state: ConnectionMilestone['state'] }) {
  if (state === 'completed') {
    return (
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full text-white"
        style={{ background: MATCHMAKER_THEME.primary }}
      >
        <IoCheckmark size={16} />
      </span>
    );
  }
  if (state === 'current') {
    return (
      <span className="relative flex h-7 w-7 items-center justify-center">
        <span
          className="absolute inset-0 animate-ping rounded-full opacity-30"
          style={{ background: MATCHMAKER_THEME.accent }}
        />
        <span
          className="relative h-5 w-5 rounded-full border-2"
          style={{ borderColor: MATCHMAKER_THEME.accent, background: MATCHMAKER_THEME.surface }}
        />
      </span>
    );
  }
  return (
    <span
      className="h-7 w-7 rounded-full border-2"
      style={{ borderColor: MATCHMAKER_THEME.disabled, background: MATCHMAKER_THEME.surface }}
    />
  );
}
