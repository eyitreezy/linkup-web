'use client';

import { PlanFlowHeader } from '@/features/plans/PlanFlowHeader';
import { openDirectChatPath } from '@/lib/messaging/openDirectChat';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IoChatbubbleEllipsesOutline } from 'react-icons/io5';

type Props = { escrowId: string };

export function EscrowDetailScreen({ escrowId }: Props) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const { data, isLoading, error } = useQuery({
    queryKey: ['escrow', escrowId],
    queryFn: async () => {
      const client = createClient();
      const { data: row, error: err } = await client
        .from('escrow_transactions')
        .select('*, plans(title, location_label)')
        .eq('id', escrowId)
        .single();
      if (err) throw new Error(err.message);
      return row as {
        id: string;
        status: string;
        amount_cents: number;
        funding_deadline: string | null;
        payer_id: string;
        payee_id: string;
        host_id: string;
        guest_id: string;
        escrow_pattern: string;
        plans: { title: string; location_label: string | null } | null;
      };
    },
  });

  async function onMessage() {
    if (!user?.id || !data) return;
    const other =
      user.id === data.host_id
        ? data.guest_id
        : user.id === data.guest_id
          ? data.host_id
          : user.id === data.payer_id
            ? data.payee_id
            : data.payer_id;
    try {
      const client = createClient();
      const path = await openDirectChatPath(client, user.id, other);
      router.push(path);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not open chat');
    }
  }

  if (isLoading) {
    return <p className="text-[14px] font-semibold text-muted">Loading escrow…</p>;
  }

  if (error || !data) {
    return (
      <div className="linkup-card px-6 py-10 text-center">
        <p className="font-extrabold text-foreground">Escrow not found</p>
        <Link href="/discover" className="mt-3 inline-block font-extrabold text-primary underline">
          Discover
        </Link>
      </div>
    );
  }

  const amount = `₦${(data.amount_cents / 100).toLocaleString()}`;
  const planTitle = data.plans?.title ?? 'Meetup';

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <PlanFlowHeader
        kicker="Secure payment"
        title={planTitle}
        subtitle="Fund through LinkUp escrow — same protection as the mobile app."
        backHref="/offers"
      />

      <section className="linkup-card space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-[12px] font-extrabold capitalize text-primary">
            {data.status.replace(/_/g, ' ')}
          </span>
          <p className="font-display text-2xl font-extrabold text-primary">{amount}</p>
        </div>
        {data.funding_deadline ? (
          <p className="text-[13px] font-semibold text-muted">
            Fund by{' '}
            {new Date(data.funding_deadline).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        ) : null}
        <p className="text-[13px] font-semibold text-muted">
          Pattern {data.escrow_pattern} · Paystack checkout on mobile is fully wired; web payment redirect is
          coming soon. Use the LinkUp app to complete funding if you are on a deadline.
        </p>
        <button
          type="button"
          onClick={() => void onMessage()}
          className="inline-flex items-center gap-2 rounded-full border border-primary/25 px-5 py-2.5 text-[14px] font-extrabold text-primary"
        >
          <IoChatbubbleEllipsesOutline size={18} />
          Message counterpart
        </button>
      </section>
    </div>
  );
}
