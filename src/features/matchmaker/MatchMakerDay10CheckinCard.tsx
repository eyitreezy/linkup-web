'use client';

import {
  day10CheckinPlanDaysCopy,
  dismissDay10Checkin,
  isConversationStale,
  pickConversationStarter,
} from '@/lib/matchmaker/day10Checkin';
import type { MatchMakerConnectionRow } from '@/lib/matchmaker/connection';
import { MATCHMAKER_THEME } from '@/lib/matchmaker/theme';
import { useEffect } from 'react';

type Props = {
  connection: MatchMakerConnectionRow;
  partnerName: string;
  partnerLastMessageAt: string | null;
  viewerLastMessageAt: string | null;
  onDismiss: () => void;
  onCopyStarter: (text: string) => void;
};

export function MatchMakerDay10CheckinCard({
  connection,
  partnerName,
  partnerLastMessageAt,
  viewerLastMessageAt,
  onDismiss,
  onCopyStarter,
}: Props) {
  const stale = isConversationStale(partnerLastMessageAt, viewerLastMessageAt);
  const starter = stale ? pickConversationStarter(connection.id, partnerName) : null;

  useEffect(() => {
    const t = window.setTimeout(() => {
      dismissDay10Checkin(connection.id);
      onDismiss();
    }, 8000);
    return () => window.clearTimeout(t);
  }, [connection.id, onDismiss]);

  return (
    <div
      className="mb-4 rounded-2xl border px-4 py-4 shadow-sm matchmaker-slide-in-right"
      style={{ borderColor: MATCHMAKER_THEME.border, background: MATCHMAKER_THEME.surfaceWarm }}
      role="status"
    >
      <p className="text-[14px] font-extrabold" style={{ color: MATCHMAKER_THEME.textPrimary }}>
        You have been connected for 10 days.
      </p>
      {stale ? (
        <>
          <p className="mt-2 text-[13px] font-semibold leading-relaxed" style={{ color: MATCHMAKER_THEME.textMuted }}>
            Connections grow through conversation. Here is a prompt to get things going:
          </p>
          <p
            className="mt-3 rounded-xl border px-3 py-3 text-[13px] font-semibold leading-relaxed"
            style={{ borderColor: MATCHMAKER_THEME.border, background: MATCHMAKER_THEME.surface }}
          >
            {starter}
          </p>
          <button
            type="button"
            onClick={() => {
              if (starter) onCopyStarter(starter);
              dismissDay10Checkin(connection.id);
              onDismiss();
            }}
            className="mt-3 text-[13px] font-extrabold underline"
            style={{ color: MATCHMAKER_THEME.accent }}
          >
            Copy to chat
          </button>
        </>
      ) : (
        <p className="mt-2 text-[13px] font-semibold leading-relaxed" style={{ color: MATCHMAKER_THEME.textMuted }}>
          How is the conversation going? {day10CheckinPlanDaysCopy(connection)}
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          dismissDay10Checkin(connection.id);
          onDismiss();
        }}
        className="mt-3 text-[12px] font-semibold underline"
        style={{ color: MATCHMAKER_THEME.textMuted }}
      >
        Dismiss
      </button>
    </div>
  );
}
