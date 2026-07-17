'use client';

import { ChatThread } from '@/features/messages/ChatThread';
import { createClient } from '@/lib/supabase/client';
import type { InboxRow } from '@/services/messages.service';
import { useAuthStore } from '@/stores/auth-store';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
export default function GroupChatPage() {
  const params = useParams<{ id: string }>();
  const conversationId = params.id;
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [peer, setPeer] = useState<InboxRow | null>(null);
  const [suggestionPlan, setSuggestionPlan] = useState<{
    status: string;
    scheduled_at: string | null;
    meet_type_id: string | null;
    creator_id: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId || !user?.id) return;
    let cancelled = false;
    const client = createClient();
    void (async () => {
      const { data: conv } = await client
        .from('conversations')
        .select('id, group_name, group_avatar_url, plan_id')
        .eq('id', conversationId)
        .eq('is_group_chat', true)
        .maybeSingle();
      if (cancelled) return;
      if (!conv) {
        setPeer(null);
        setSuggestionPlan(null);
        setLoading(false);
        return;
      }
      const planId = (conv.plan_id as string | null) ?? null;
      let planContext: {
        status: string;
        scheduled_at: string | null;
        meet_type_id: string | null;
        creator_id: string;
      } | null = null;
      if (planId) {
        const { data: plan } = await client
          .from('plans')
          .select('status, scheduled_at, meet_type_id, creator_id')
          .eq('id', planId)
          .maybeSingle();
        if (plan) {
          planContext = {
            status: plan.status as string,
            scheduled_at: (plan.scheduled_at as string | null) ?? null,
            meet_type_id: (plan.meet_type_id as string | null) ?? null,
            creator_id: plan.creator_id as string,
          };
        }
      }
      const { count } = await client
        .from('group_chat_members')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .is('removed_at', null);
      setPeer({
        id: conv.id as string,
        otherId: conv.id as string,
        name: (conv.group_name as string) ?? 'Group chat',
        avatarUrl: null,
        verified: false,
        preview: '',
        timeIso: new Date().toISOString(),
        unread: false,
        isGroupChat: true,
        groupAvatarUrl: (conv.group_avatar_url as string | null) ?? null,
        memberCount: count ?? 0,
        planId,
      });
      setSuggestionPlan(planContext);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, user?.id]);

  if (loading) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center">
        <p className="text-[14px] font-semibold text-muted">Loading group chat…</p>
      </div>
    );
  }

  if (!peer) {
    return (
      <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-extrabold text-foreground">Group chat not found</p>
        <Link href="/messages" className="font-extrabold text-primary underline">
          Back to inbox
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-var(--linkup-top-offset,0px))] min-h-0 flex-col">
      <ChatThread
        conversationId={conversationId}
        peer={peer}
        suggestionPlan={suggestionPlan}
        onBack={() => router.push('/messages')}
      />
    </div>
  );
}
