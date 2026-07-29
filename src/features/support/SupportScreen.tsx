'use client';

import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { AppStatusDialog } from '@/components/ui/AppStatusDialog';
import { FormCard } from '@/components/settings/FormCard';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { TierBadge } from '@/components/subscription/TierBadge';
import { PremiumSectionHead } from '@/features/premium/PremiumSectionHead';
import { useSubscriptionContext } from '@/lib/subscription/SubscriptionContext';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import type { DbSupportTicket, TicketStatus } from '@/types/database';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IoCardOutline,
  IoClose,
  IoHeartOutline,
  IoShieldCheckmarkOutline,
  IoTimeOutline,
} from 'react-icons/io5';

const SUBJECT_OPTIONS = [
  'Payment & escrow',
  'Account & verification',
  'Safety & reports',
  'Bug or app issue',
  'Something else',
] as const;

type EscrowHint = { id: string; plan_id: string | null; status: string };

function statusLabel(s: TicketStatus): string {
  switch (s) {
    case 'open':
      return 'Open';
    case 'in_progress':
      return 'In progress';
    case 'resolved':
      return 'Resolved';
    case 'closed':
      return 'Closed';
    default:
      return s;
  }
}

function isOpenTab(s: TicketStatus): boolean {
  return s === 'open' || s === 'in_progress';
}

export function SupportScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const { subscriptionState } = useSubscriptionContext();
  const [tickets, setTickets] = useState<DbSupportTicket[]>([]);
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [subject, setSubject] = useState<string>(SUBJECT_OPTIONS[0]);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [conciergeOpen, setConciergeOpen] = useState(false);
  const [conciergeBody, setConciergeBody] = useState('');
  const [conciergeBusy, setConciergeBusy] = useState(false);
  const [disambigOpen, setDisambigOpen] = useState(false);
  const [disambigEscrows, setDisambigEscrows] = useState<EscrowHint[]>([]);
  const [feedback, setFeedback] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: 'success' | 'error';
  }>({ open: false, title: '', message: '', variant: 'success' });

  const load = useCallback(async () => {
    if (!user?.id) {
      setTickets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const client = createClient();
    const { data, error } = await client
      .from('support_tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    setLoading(false);
    if (error) {
      setFeedback({ open: true, title: 'Could not load', message: error.message, variant: 'error' });
    } else {
      setTickets((data as DbSupportTicket[]) ?? []);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => tickets.filter((t) => (tab === 'open' ? isOpenTab(t.status) : !isOpenTab(t.status))),
    [tickets, tab]
  );

  async function checkPaymentDisambiguation(): Promise<boolean> {
    if (!user?.id) return false;
    const client = createClient();
    const { data } = await client
      .from('escrow_transactions')
      .select('id, plan_id, status')
      .in('status', ['pending_funding', 'funded', 'disputed'])
      .or(`payer_id.eq.${user.id},payee_id.eq.${user.id}`)
      .limit(3);
    if (data && data.length > 0) {
      setDisambigEscrows(data as EscrowHint[]);
      setDisambigOpen(true);
      return true;
    }
    return false;
  }

  async function openTicketModal(topic?: string) {
    if (topic) setSubject(topic);
    if (topic === 'Payment & escrow') {
      const shown = await checkPaymentDisambiguation();
      if (shown) return;
    }
    setModalOpen(true);
  }

  async function submitTicket() {
    if (!user?.id || !body.trim()) {
      setFeedback({
        open: true,
        title: 'Missing details',
        message: 'Please describe what you need help with.',
        variant: 'error',
      });
      return;
    }
    if (subject === 'Payment & escrow') {
      const shown = await checkPaymentDisambiguation();
      if (shown) return;
    }
    setSubmitting(true);
    const client = createClient();
    const { error } = await client.from('support_tickets').insert({
      user_id: user.id,
      subject,
      body: body.trim(),
      status: 'open',
    });
    setSubmitting(false);
    if (error) {
      setFeedback({ open: true, title: 'Could not send', message: error.message, variant: 'error' });
    } else {
      setModalOpen(false);
      setBody('');
      await load();
      setFeedback({
        open: true,
        title: 'Ticket sent',
        message: 'Our team will reply in your ticket thread.',
        variant: 'success',
      });
    }
  }

  async function submitConcierge() {
    if (!user?.id || !conciergeBody.trim()) return;
    setConciergeBusy(true);
    const client = createClient();
    const { error } = await client.from('support_tickets').insert({
      user_id: user.id,
      subject: `Concierge: ${conciergeBody.substring(0, 50)}`,
      body: conciergeBody.trim(),
      is_concierge: true,
      queue_priority: 1,
      sla_hours: 2,
      sla_deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      status: 'open',
      priority: 'high',
    });
    setConciergeBusy(false);
    if (error) {
      setFeedback({ open: true, title: 'Concierge', message: error.message, variant: 'error' });
      return;
    }
    setConciergeOpen(false);
    setConciergeBody('');
    await load();
    setFeedback({
      open: true,
      title: 'Concierge request sent',
      message: "We'll be in touch within 2 hours.",
      variant: 'success',
    });
  }

  if (!user) {
    return (
      <p className="text-[14px] font-semibold text-muted">
        <Link href="/login" className="font-extrabold text-primary">
          Sign in
        </Link>{' '}
        for help & support.
      </p>
    );
  }

  const firstEscrow = disambigEscrows[0];

  return (
    <div className="space-y-8 pb-10">
      <AppStatusDialog
        open={feedback.open}
        title={feedback.title}
        message={feedback.message}
        variant={feedback.variant}
        onClose={() => setFeedback((f) => ({ ...f, open: false }))}
      />

      <SettingsPageHeader
        kicker="Help"
        title="Help & support"
        subtitle="Quick answers, your tickets, and a direct line to our team."
        actions={
          <button
            type="button"
            onClick={() => void openTicketModal()}
            className="rounded-full linkup-gradient-primary px-5 py-2.5 text-[14px] font-extrabold text-white shadow-sm"
          >
            New ticket
          </button>
        }
      />

      {subscriptionState.effectiveTier === 'PLATINUM' ? (
        <div className="rounded-[22px] border border-violet-200/80 bg-gradient-to-br from-violet-50/90 via-white to-[#F8F4FF] p-5 shadow-[0_8px_24px_rgba(139,92,246,0.12)]">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <TierBadge tier="PLATINUM" size="sm" />
            <h3 className="text-[15px] font-extrabold text-violet-900">Platinum Concierge</h3>
          </div>
          <p className="text-[14px] font-semibold leading-relaxed text-violet-800/90">
            Priority human-agent support with a 2-hour response commitment.
          </p>
          <div className="mb-4 mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-violet-700">
            <IoTimeOutline size={16} aria-hidden />
            Typically responds within 2 hours
          </div>
          <button
            type="button"
            onClick={() => setConciergeOpen(true)}
            className="w-full rounded-full bg-violet-600 py-2.5 text-[14px] font-extrabold text-white transition hover:bg-violet-700"
          >
            Contact concierge
          </button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => void openTicketModal('Payment & escrow')}
          className="linkup-card p-4 text-left transition hover:ring-2 hover:ring-primary/20"
        >
          <IoCardOutline size={22} className="text-primary" />
          <h3 className="mt-2 font-extrabold">Payment issues</h3>
          <p className="mt-1 text-[13px] font-semibold text-muted">
            Escrow holds payment until the meetup is confirmed. We&apos;ll guide you to the right flow.
          </p>
        </button>
        <Link href="/kyc" className="linkup-card p-4 transition hover:ring-2 hover:ring-primary/20">
          <IoShieldCheckmarkOutline size={22} className="text-primary" />
          <h3 className="mt-2 font-extrabold">Account verification</h3>
          <p className="mt-1 text-[13px] font-semibold text-muted">
            Verified members unlock plans, negotiation, and funding escrow.
          </p>
        </Link>
        <button
          type="button"
          onClick={() => void openTicketModal('Safety & reports')}
          className="linkup-card p-4 text-left transition hover:ring-2 hover:ring-primary/20"
        >
          <IoHeartOutline size={22} className="text-primary" />
          <h3 className="mt-2 font-extrabold">Safety & reports</h3>
          <p className="mt-1 text-[13px] font-semibold text-muted">
            Your safety matters. Share details in a ticket and we&apos;ll review with care.
          </p>
        </button>
      </div>

      <div className="flex gap-2">
        {(['open', 'resolved'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-[13px] font-extrabold ${
              tab === t ? 'linkup-gradient-primary text-white' : 'border border-border bg-white text-primary'
            }`}
          >
            {t === 'open' ? 'Open' : 'Resolved'}
          </button>
        ))}
      </div>

      <PremiumSectionHead title="Your tickets" />

      {loading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-[#EDE8FF]/70" />
      ) : filtered.length === 0 ? (
        <AppEmptyState
          emoji={tab === 'open' ? '💬' : '✅'}
          title={tab === 'open' ? 'No open tickets' : 'No resolved tickets yet'}
          titleAccent={tab === 'open' ? 'open' : undefined}
          description={
            tab === 'open'
              ? 'When you need help with payments, verification, or safety, start a ticket. Our team sees the same queue as the mobile app.'
              : 'Resolved conversations stay here for your records once we close a ticket.'
          }
          tips={
            tab === 'open'
              ? [
                  {
                    icon: IoCardOutline,
                    text: 'Payment and escrow questions: include plan title and approximate date',
                    iconBgClassName: 'bg-primary/10',
                  },
                  {
                    icon: IoShieldCheckmarkOutline,
                    text: 'Verification stuck? Mention the step you’re on in KYC',
                    iconBgClassName: 'bg-emerald-500/10',
                    iconClassName: 'text-emerald-600',
                  },
                  {
                    icon: IoTimeOutline,
                    text: 'We typically reply within one business day',
                    iconBgClassName: 'bg-secondary/10',
                    iconClassName: 'text-secondary',
                  },
                ]
              : undefined
          }
          action={
            tab === 'open'
              ? { label: 'New ticket', onClick: () => void openTicketModal() }
              : undefined
          }
          secondaryAction={
            tab === 'open'
              ? { label: 'View disputes', href: '/disputes', variant: 'secondary' }
              : {
                  label: 'Open a ticket',
                  onClick: () => {
                    setTab('open');
                    void openTicketModal();
                  },
                  variant: 'secondary',
                }
          }
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => router.push(`/support/ticket/${t.id}`)}
                className="linkup-card w-full p-4 text-left transition hover:ring-2 hover:ring-primary/15"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-extrabold text-foreground">{t.subject}</p>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-extrabold text-primary">
                    {statusLabel(t.status)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-[14px] font-semibold text-muted">{t.body}</p>
                <p className="mt-2 text-[12px] font-semibold text-muted">
                  Updated {new Date(t.updated_at).toLocaleString()}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <FormCard className="max-h-[90vh] w-full max-w-lg overflow-y-auto">
            <h2 className="font-display text-xl font-extrabold">New support ticket</h2>
            <label className="mt-4 block text-[13px] font-extrabold">Topic</label>
            <select
              className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-[14px] font-semibold"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              {SUBJECT_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <label className="mt-4 block text-[13px] font-extrabold">Details</label>
            <textarea
              className="mt-1 min-h-[120px] w-full rounded-xl border border-border px-3 py-2.5 text-[14px] font-semibold"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Tell us what happened…"
            />
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 rounded-full border py-3 font-extrabold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submitTicket()}
                className="flex-[2] rounded-full linkup-gradient-primary py-3 font-extrabold text-white disabled:opacity-50"
              >
                {submitting ? 'Sending…' : 'Submit'}
              </button>
            </div>
          </FormCard>
        </div>
      ) : null}

      {conciergeOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <FormCard className="w-full max-w-md">
            <div className="mb-3 flex items-center gap-2">
              <TierBadge tier="PLATINUM" size="sm" />
              <h2 className="font-display text-xl font-extrabold">Concierge support</h2>
            </div>
            <textarea
              className="min-h-[120px] w-full rounded-xl border border-violet-200 px-3 py-2.5 text-[14px] font-semibold focus:outline-none focus:ring-2 focus:ring-violet-300/50"
              value={conciergeBody}
              onChange={(e) => setConciergeBody(e.target.value)}
              placeholder="Describe your issue…"
            />
            <p className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-violet-700">
              <IoTimeOutline size={14} aria-hidden />
              We&apos;ll respond within 2 hours.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setConciergeOpen(false)}
                className="flex-1 rounded-full border py-3 font-extrabold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={conciergeBusy || !conciergeBody.trim()}
                onClick={() => void submitConcierge()}
                className="flex-[2] rounded-full bg-violet-600 py-3 font-extrabold text-white disabled:opacity-50"
              >
                {conciergeBusy ? 'Sending…' : 'Send to concierge'}
              </button>
            </div>
          </FormCard>
        </div>
      ) : null}

      {disambigOpen && firstEscrow ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close"
            onClick={() => setDisambigOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-t-3xl border border-border bg-white p-5 shadow-xl sm:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold">What&apos;s the issue?</h2>
              <button
                type="button"
                onClick={() => setDisambigOpen(false)}
                className="rounded-full p-2 text-muted hover:bg-[#F5F6FA]"
                aria-label="Close"
              >
                <IoClose size={22} />
              </button>
            </div>
            <div className="space-y-2 pb-2">
              <button
                type="button"
                onClick={() => {
                  setDisambigOpen(false);
                  router.push(`/escrow/${firstEscrow.id}`);
                }}
                className="w-full rounded-xl border border-border p-4 text-left transition hover:border-primary/25 hover:bg-[#F8F7FF]"
              >
                <p className="text-[14px] font-extrabold text-foreground">Money stuck / wrong amount in escrow</p>
                <p className="mt-1 text-[12px] font-semibold text-muted">
                  Go to your escrow screen to dispute and hold the funds
                </p>
              </button>
              {firstEscrow.plan_id ? (
                <button
                  type="button"
                  onClick={() => {
                    setDisambigOpen(false);
                    router.push(`/dispute/${firstEscrow.plan_id}/detail`);
                  }}
                  className="w-full rounded-xl border border-border p-4 text-left transition hover:border-primary/25 hover:bg-[#F8F7FF]"
                >
                  <p className="text-[14px] font-extrabold text-foreground">Misconduct, scam, or safety concern</p>
                  <p className="mt-1 text-[12px] font-semibold text-muted">
                    View your plan dispute or file from the plan screen
                  </p>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setDisambigOpen(false);
                  setModalOpen(true);
                }}
                className="w-full rounded-xl border border-border p-4 text-left transition hover:border-primary/25 hover:bg-[#F8F7FF]"
              >
                <p className="text-[14px] font-extrabold text-foreground">Something else: contact support</p>
                <p className="mt-1 text-[12px] font-semibold text-muted">A support agent will help you</p>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
