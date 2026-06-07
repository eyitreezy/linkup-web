'use client';

import { AppEmptyState } from '@/components/ui/AppEmptyState';
import { FormCard } from '@/components/settings/FormCard';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { PremiumSectionHead } from '@/features/premium/PremiumSectionHead';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import type { DbSupportTicket, TicketStatus } from '@/types/database';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IoCardOutline,
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
  const [tickets, setTickets] = useState<DbSupportTicket[]>([]);
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [subject, setSubject] = useState<string>(SUBJECT_OPTIONS[0]);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    if (error) alert(error.message);
    else setTickets((data as DbSupportTicket[]) ?? []);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => tickets.filter((t) => (tab === 'open' ? isOpenTab(t.status) : !isOpenTab(t.status))),
    [tickets, tab]
  );

  async function submitTicket() {
    if (!user?.id || !body.trim()) {
      alert('Please describe what you need help with.');
      return;
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
    if (error) alert(error.message);
    else {
      setModalOpen(false);
      setBody('');
      await load();
    }
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

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader
        kicker="Help"
        title="Help & support"
        subtitle="Quick answers, your tickets, and a direct line to our team."
        actions={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-full linkup-gradient-primary px-5 py-2.5 text-[14px] font-extrabold text-white shadow-sm"
          >
            New ticket
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="linkup-card p-4">
          <IoCardOutline size={22} className="text-primary" />
          <h3 className="mt-2 font-extrabold">Payment issues</h3>
          <p className="mt-1 text-[13px] font-semibold text-muted">
            Escrow holds payment until the meetup is confirmed. Open a dispute from escrow if something&apos;s wrong.
          </p>
        </div>
        <Link href="/kyc" className="linkup-card p-4 transition hover:ring-2 hover:ring-primary/20">
          <IoShieldCheckmarkOutline size={22} className="text-primary" />
          <h3 className="mt-2 font-extrabold">Account verification</h3>
          <p className="mt-1 text-[13px] font-semibold text-muted">
            Verified members unlock plans, negotiation, and funding escrow.
          </p>
        </Link>
        <div className="linkup-card p-4">
          <IoHeartOutline size={22} className="text-primary" />
          <h3 className="mt-2 font-extrabold">Safety & reports</h3>
          <p className="mt-1 text-[13px] font-semibold text-muted">
            Your safety matters. Share details in a ticket and we&apos;ll review with care.
          </p>
        </div>
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
              ? 'When you need help with payments, verification, or safety, start a ticket — our team sees the same queue as the mobile app.'
              : 'Resolved conversations stay here for your records once we close a ticket.'
          }
          tips={
            tab === 'open'
              ? [
                  {
                    icon: IoCardOutline,
                    text: 'Payment & escrow questions — include plan title and approximate date',
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
              ? { label: 'New ticket', onClick: () => setModalOpen(true) }
              : undefined
          }
          secondaryAction={
            tab === 'open'
              ? { label: 'View disputes', href: '/disputes', variant: 'secondary' }
              : { label: 'Open a ticket', onClick: () => { setTab('open'); setModalOpen(true); }, variant: 'secondary' }
          }
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((t) => (
            <li key={t.id} className="linkup-card p-4">
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
    </div>
  );
}
