'use client';

import {
  parseGroupMentionSegments,
  type MentionSegment,
} from '@/lib/messaging/groupMentions';
import { cn } from '@/utils/cn';

type Props = {
  body: string;
  nameByUserId: Map<string, string>;
  mine: boolean;
};

export function MentionFormattedText({ body, nameByUserId, mine }: Props) {
  const segments = parseGroupMentionSegments(body, nameByUserId);
  if (segments.length === 1 && segments[0]?.type === 'text') {
    return <>{body}</>;
  }

  return (
    <>
      {segments.map((segment, index) => (
        <MentionSegmentText key={`${segment.type}-${index}`} segment={segment} mine={mine} />
      ))}
    </>
  );
}

function MentionSegmentText({ segment, mine }: { segment: MentionSegment; mine: boolean }) {
  if (segment.type === 'text') return <>{segment.value}</>;
  return (
    <span
      className={cn(
        'rounded px-1 font-extrabold',
        mine ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
      )}
    >
      {segment.label}
    </span>
  );
}
