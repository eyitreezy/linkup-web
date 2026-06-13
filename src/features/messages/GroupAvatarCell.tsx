'use client';

import { cn } from '@/utils/cn';
import type { InboxMemberPreview } from '@/services/messages.service';

type Props = {
  avatarUrl?: string | null;
  groupName: string;
  memberPreviews?: InboxMemberPreview[];
  size?: number;
  compact?: boolean;
};

export function GroupAvatarCell({
  avatarUrl,
  groupName,
  memberPreviews = [],
  size,
  compact,
}: Props) {
  const px = size ?? (compact ? 50 : 58);
  const initial = groupName.charAt(0).toUpperCase();

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={groupName}
        className="shrink-0 rounded-full object-cover"
        style={{ width: px, height: px }}
      />
    );
  }

  const previews = memberPreviews.slice(0, 4);
  if (previews.length === 0) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full bg-[#EDE8FF] font-extrabold text-primary"
        style={{ width: px, height: px, fontSize: px * 0.3 }}
      >
        {initial}
      </div>
    );
  }

  return (
    <div
      className="grid shrink-0 grid-cols-2 overflow-hidden rounded-full bg-[#EDE8FF]"
      style={{ width: px, height: px }}
    >
      {previews.map((m, i) =>
        m.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={m.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            key={i}
            className={cn(
              'flex h-full w-full items-center justify-center bg-[#EDE8FF] font-extrabold text-primary',
              'text-[10px]'
            )}
          >
            {m.name.charAt(0).toUpperCase()}
          </div>
        )
      )}
    </div>
  );
}
