'use client';

import { GroupChatInfoScreen } from '@/features/messages/GroupChatInfoScreen';
import { useParams } from 'next/navigation';

export default function GroupChatInfoPage() {
  const params = useParams<{ id: string }>();
  return (
    <div className="px-4 py-4">
      <GroupChatInfoScreen conversationId={params.id} />
    </div>
  );
}
