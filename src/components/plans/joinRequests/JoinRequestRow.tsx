'use client';

import { JoinRequestStatusBadge } from '@/components/plans/joinRequests/JoinRequestStatusBadge';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import type { JoinRequestWithRequester } from '@/lib/plans/joinRequests';
import { cn } from '@/utils/cn';

type Props = {
  request: JoinRequestWithRequester;
  onApprove?: () => void;
  onDecline?: () => void;
  busy?: boolean;
};

export function JoinRequestRow({ request, onApprove, onDecline, busy }: Props) {
  const name = request.requester?.display_name?.trim() || 'Guest';

  return (
    <div className="linkup-card space-y-3 p-4">
      <div className="flex items-start gap-3">
        <ProfileAvatar
          profile={request.requester}
          displayName={name}
          size={44}
          ringClassName="ring-2 ring-primary/10"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-extrabold text-foreground">{name}</p>
          {request.message ? (
            <p className="mt-0.5 text-[13px] font-semibold leading-relaxed text-muted">{request.message}</p>
          ) : (
            <p className="mt-0.5 text-[13px] font-semibold italic text-muted">No message</p>
          )}
        </div>
      </div>

      {request.status === 'pending' && onApprove && onDecline ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onApprove}
            className="min-h-[40px] flex-1 rounded-full linkup-gradient-primary px-4 text-[13px] font-extrabold text-white transition hover:opacity-95 disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Approve'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDecline}
            className={cn(
              'min-h-[40px] flex-1 rounded-full border border-primary/25 bg-white px-4 text-[13px] font-extrabold text-primary transition hover:bg-[#EDE8FF]/50 disabled:opacity-50'
            )}
          >
            Decline
          </button>
        </div>
      ) : (
        <JoinRequestStatusBadge status={request.status} />
      )}
    </div>
  );
}
