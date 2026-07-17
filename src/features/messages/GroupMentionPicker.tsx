'use client';

import type { GroupMentionMember } from '@/lib/messaging/groupMentions';
import { cn } from '@/utils/cn';

type Props = {
  members: GroupMentionMember[];
  avatarByUserId?: Map<string, string | null>;
  visible: boolean;
  onSelect: (member: GroupMentionMember) => void;
};

function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return 'M';
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || 'M';
}

export function GroupMentionPicker({ members, avatarByUserId, visible, onSelect }: Props) {
  if (!visible || members.length === 0) return null;

  return (
    <div className="max-h-48 overflow-y-auto border-b border-border/60 bg-white/95 px-2 py-2">
      <p className="px-2 pb-1 text-[11px] font-extrabold uppercase tracking-wide text-muted">
        Mention someone
      </p>
      <ul className="space-y-1">
        {members.map((member) => {
          const avatar = avatarByUserId?.get(member.userId) ?? null;
          return (
            <li key={member.userId}>
              <button
                type="button"
                onClick={() => onSelect(member)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition',
                  'hover:bg-primary/10 active:bg-primary/15'
                )}
                aria-label={`Mention ${member.displayName}`}
              >
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[11px] font-extrabold text-primary">
                    {initials(member.displayName)}
                  </span>
                )}
                <span className="truncate text-[14px] font-bold text-foreground">{member.displayName}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
