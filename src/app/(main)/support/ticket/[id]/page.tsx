import { TicketDetailClient } from '@/features/support/TicketDetailClient';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import type { DbSupportTicket, DbTicketReply } from '@/types/database';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function SupportTicketDetailPage({ params }: Props) {
  const { id } = await params;

  if (!isSupabaseConfigured) {
    return (
      <p className="text-[14px] font-semibold text-muted">Configure Supabase to view tickets.</p>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!ticket) {
    return (
      <div className="linkup-card px-6 py-12 text-center">
        <p className="font-extrabold text-foreground">Ticket not found</p>
        <Link href="/support" className="mt-3 inline-block font-extrabold text-primary underline">
          Back to support
        </Link>
      </div>
    );
  }

  const { data: replies } = await supabase
    .from('ticket_replies')
    .select('*')
    .eq('ticket_id', id)
    .eq('is_internal', false)
    .order('created_at', { ascending: true });

  return (
    <TicketDetailClient
      ticket={ticket as DbSupportTicket}
      initialReplies={(replies ?? []) as DbTicketReply[]}
    />
  );
}
