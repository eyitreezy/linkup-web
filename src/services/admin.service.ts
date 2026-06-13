import { createClient } from '@/lib/supabase/client';
import type {
  AccountStatus,
  DbDispute,
  DbDisputeEvidence,
  DbEscrowTransaction,
  DbModerationLog,
  DbPlan,
  DbProfile,
  DbReport,
  DbSupportTicket,
  DbUser,
  DbVerificationEvent,
  DbVerificationRequest,
  UserVerification,
} from '@/types/database';

export type VerRow = Pick<
  DbVerificationRequest,
  | 'id'
  | 'user_id'
  | 'status'
  | 'created_at'
  | 'rejection_reason'
  | 'id_document_path'
  | 'selfie_video_path'
  | 'reviewed_by'
>;

export type ProfileSnippet = { display_name: string | null; avatar_url: string | null };

export type EscrowDisputeRow = {
  id: string;
  reason: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  escrow_id: string | null;
  opened_by: string | null;
  admin_resolution: string | null;
  support_ticket_id: string | null;
  detail: string | null;
  queue_priority: number | null;
  sla_deadline: string | null;
  escrow_row?: Pick<
    DbEscrowTransaction,
    | 'id'
    | 'amount_cents'
    | 'currency'
    | 'plan_id'
    | 'payer_id'
    | 'payee_id'
    | 'status'
    | 'platform_fee_cents'
  > | null;
};

export type AdminDashboardData = {
  ver: VerRow[];
  kycProfiles: Record<string, ProfileSnippet>;
  planDisputes: DbDispute[];
  escrowDisputes: EscrowDisputeRow[];
  tickets: DbSupportTicket[];
  reports: DbReport[];
  mods: DbModerationLog[];
  modProfiles: Record<string, ProfileSnippet>;
  modMessagePreview: Record<string, string>;
  modPlanTitle: Record<string, string>;
};

const SEV_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export async function loadAdminDashboard(): Promise<AdminDashboardData> {
  const client = createClient();

  const { data: v } = await client
    .from('verification_requests')
    .select(
      'id, user_id, status, created_at, rejection_reason, id_document_path, selfie_video_path, reviewed_by'
    )
    .order('created_at', { ascending: false })
    .limit(40);

  const ver = (v ?? []) as VerRow[];
  const kycProfiles: Record<string, ProfileSnippet> = {};
  const uidSet = [...new Set(ver.map((r) => r.user_id))];
  if (uidSet.length) {
    const { data: profs } = await client
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', uidSet);
    for (const p of profs ?? []) {
      kycProfiles[p.user_id as string] = {
        display_name: p.display_name as string | null,
        avatar_url: p.avatar_url as string | null,
      };
    }
  }

  const { data: pdi } = await client.from('disputes').select('*').order('created_at', { ascending: false }).limit(80);

  const { data: d } = await client
    .from('escrow_disputes')
    .select(
      'id, reason, status, created_at, resolved_at, escrow_id, opened_by, admin_resolution, support_ticket_id, detail, queue_priority, sla_deadline'
    )
    .order('queue_priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(40);

  let escrowDisputes: EscrowDisputeRow[] = [];
  if (d?.length) {
    const escrowIds = [
      ...new Set(
        d.map((x) => x.escrow_id).filter((id): id is string => typeof id === 'string' && id.length > 0)
      ),
    ];
    const byEscrow: Record<string, EscrowDisputeRow['escrow_row']> = {};
    if (escrowIds.length) {
      const { data: escrows } = await client
        .from('escrow_transactions')
        .select('id, amount_cents, currency, plan_id, payer_id, payee_id, status, platform_fee_cents')
        .in('id', escrowIds);
      for (const e of escrows ?? []) {
        byEscrow[e.id as string] = e as EscrowDisputeRow['escrow_row'];
      }
    }
    escrowDisputes = d.map((row) => ({
      ...(row as EscrowDisputeRow),
      escrow_row: row.escrow_id ? byEscrow[row.escrow_id as string] ?? null : null,
    }));
  }

  const { data: t } = await client
    .from('support_tickets')
    .select(
      'id, user_id, subject, body, status, priority, queue_priority, sla_deadline, is_concierge, created_at, updated_at'
    )
    .order('queue_priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(120);

  const { data: r } = await client.from('reports').select('*').order('created_at', { ascending: false }).limit(80);

  const { data: m } = await client.from('moderation_logs').select('*').order('created_at', { ascending: false }).limit(120);

  let mods: DbModerationLog[] = [];
  const modProfiles: Record<string, ProfileSnippet> = {};
  const modMessagePreview: Record<string, string> = {};
  const modPlanTitle: Record<string, string> = {};

  if (m?.length) {
    mods = [...(m as DbModerationLog[])].sort(
      (a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9)
    );
    const modUserIds = [...new Set(mods.map((row) => row.user_id))];
    if (modUserIds.length) {
      const { data: profs } = await client
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', modUserIds);
      for (const p of profs ?? []) {
        modProfiles[p.user_id as string] = {
          display_name: p.display_name as string | null,
          avatar_url: p.avatar_url as string | null,
        };
      }
    }
    const messageIds = [...new Set(mods.filter((row) => row.content_type === 'message').map((row) => row.content_id))];
    if (messageIds.length) {
      const { data: msgs } = await client.from('messages').select('id, text, body').in('id', messageIds);
      for (const row of msgs ?? []) {
        const blob = (row.text as string | null) ?? (row.body as string | null);
        if (typeof blob === 'string' && blob.trim()) {
          modMessagePreview[row.id as string] = blob.trim().slice(0, 320);
        }
      }
    }
    const planIds = [...new Set(mods.filter((row) => row.content_type === 'plan').map((row) => row.content_id))];
    if (planIds.length) {
      const { data: plans } = await client.from('plans').select('id, title').in('id', planIds);
      for (const row of plans ?? []) {
        const title = (row.title as string | null)?.trim();
        if (title) modPlanTitle[row.id as string] = title.slice(0, 160);
      }
    }
  }

  return {
    ver,
    kycProfiles,
    planDisputes: (pdi ?? []) as DbDispute[],
    escrowDisputes,
    tickets: (t ?? []) as DbSupportTicket[],
    reports: (r ?? []) as DbReport[],
    mods,
    modProfiles,
    modMessagePreview,
    modPlanTitle,
  };
}

export async function loadKycExtras(row: VerRow) {
  const client = createClient();
  const [{ data: ev }, idSigned, vidSigned] = await Promise.all([
    client
      .from('verification_events')
      .select('*')
      .eq('verification_id', row.id)
      .order('created_at', { ascending: true }),
    row.id_document_path
      ? client.storage.from('verification').createSignedUrl(row.id_document_path, 3600)
      : Promise.resolve({ data: null }),
    row.selfie_video_path
      ? client.storage.from('verification').createSignedUrl(row.selfie_video_path, 3600)
      : Promise.resolve({ data: null }),
  ]);
  return {
    events: (ev ?? []) as DbVerificationEvent[],
    idUrl: idSigned.data?.signedUrl ?? null,
    selfieUrl: vidSigned.data?.signedUrl ?? null,
  };
}

export async function approveVerification(id: string, adminRecordId: string | null) {
  const client = createClient();
  return client
    .from('verification_requests')
    .update({
      status: 'admin_approved',
      reviewed_by: adminRecordId,
      rejection_reason: null,
    })
    .eq('id', id);
}

export async function rejectVerification(id: string, reason: string, adminRecordId: string | null) {
  const client = createClient();
  return client
    .from('verification_requests')
    .update({
      status: 'admin_rejected',
      rejection_reason: reason.trim(),
      reviewed_by: adminRecordId,
    })
    .eq('id', id);
}

export async function resolveReport(id: string) {
  const client = createClient();
  return client.from('reports').update({ status: 'resolved' }).eq('id', id);
}

export async function warnReportedUser(targetId: string) {
  const client = createClient();
  const { error: nErr } = await client.rpc('admin_send_user_notice', {
    p_user_id: targetId,
    p_title: 'Account notice',
    p_body:
      'We reviewed a report involving your account. Please follow our community guidelines. Repeated issues may lead to further action.',
    p_data: { href: '/profile' },
  });
  if (nErr) return { error: nErr.message };
  const { error: uErr } = await client.from('users').update({ account_status: 'restricted' }).eq('id', targetId);
  return { error: uErr?.message ?? null };
}

export async function suspendReportedUser(targetId: string) {
  const client = createClient();
  const { error: nErr } = await client.rpc('admin_send_user_notice', {
    p_user_id: targetId,
    p_title: 'Account suspended',
    p_body:
      'Your account access has been suspended following a safety review. Contact support if you believe this is a mistake.',
    p_data: { href: '/support' },
  });
  if (nErr) return { error: nErr.message };
  const { error: uErr } = await client.from('users').update({ account_status: 'suspended' }).eq('id', targetId);
  return { error: uErr?.message ?? null };
}

export async function loadReportSnippet(report: DbReport) {
  if (!report.content_id) return null;
  const client = createClient();
  if (report.content_type === 'plan') {
    const { data } = await client.from('plans').select('title, description').eq('id', report.content_id).maybeSingle();
    if (data) return [data.title, data.description].filter(Boolean).join(' — ').slice(0, 500) || null;
  }
  if (report.content_type === 'message') {
    const { data } = await client.from('messages').select('body, text').eq('id', report.content_id).maybeSingle();
    const blob = data?.body ?? data?.text;
    return typeof blob === 'string' ? blob.slice(0, 500) : null;
  }
  return null;
}

export async function getDisputeEvidenceSignedUrl(filePath: string): Promise<string | null> {
  const client = createClient();
  const { data, error } = await client.storage.from('private_disputes').createSignedUrl(filePath, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function loadPlanDisputeEvidence(disputeId: string) {
  const client = createClient();
  const { data } = await client
    .from('dispute_evidence')
    .select('*')
    .eq('dispute_id', disputeId)
    .order('created_at', { ascending: true });
  return (data ?? []) as DbDisputeEvidence[];
}

export async function savePlanDisputeNotes(disputeId: string, notes: string) {
  const client = createClient();
  return client
    .from('disputes')
    .update({ internal_notes: notes.trim() || null, status: 'reviewing' })
    .eq('id', disputeId);
}

export async function resolvePlanDispute(
  disputeId: string,
  status: 'resolved' | 'rejected',
  resolution: 'refund' | 'partial' | 'none' | null,
  notes: string,
  partialBps?: number | null
) {
  const client = createClient();
  return client.rpc('admin_resolve_plan_dispute', {
    p_dispute_id: disputeId,
    p_new_status: status,
    p_resolution: status === 'resolved' ? resolution : 'none',
    p_internal_notes: notes.trim() || null,
    p_partial_bps: resolution === 'partial' ? (partialBps ?? null) : null,
  });
}

export async function resolveEscrowDisputeRpc(
  disputeId: string,
  decision: 'release' | 'refund' | 'split',
  splitBps: number | null,
  resolutionNote: string | null
) {
  const client = createClient();
  return client.rpc('admin_resolve_escrow_dispute', {
    p_dispute_id: disputeId,
    p_decision: decision,
    p_split_bps: splitBps,
    p_resolution_note: resolutionNote,
  });
}

export async function loadTicketReplies(ticketId: string) {
  const client = createClient();
  const { data } = await client
    .from('ticket_replies')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  return (data ?? []) as import('@/types/database').DbTicketReply[];
}

export async function sendTicketReply(args: {
  ticketId: string;
  senderId: string;
  body: string;
  isInternal: boolean;
}) {
  const client = createClient();
  return client.from('ticket_replies').insert({
    ticket_id: args.ticketId,
    sender_id: args.senderId,
    sender_role: 'admin',
    body: args.body.trim(),
    is_internal: args.isInternal,
  });
}

export async function updateSupportTicket(
  ticketId: string,
  patch: { status?: string; priority?: string }
) {
  const client = createClient();
  return client.from('support_tickets').update(patch).eq('id', ticketId);
}

export type AdminUserListRow = DbUser & { profiles: DbProfile | DbProfile[] | null };

export function oneProfile(p: DbProfile | DbProfile[] | null): DbProfile | null {
  if (p == null) return null;
  return Array.isArray(p) ? (p[0] ?? null) : p;
}

export async function loadAdminUsers() {
  const client = createClient();
  const [{ data: usersData, error: uErr }, { data: admData }] = await Promise.all([
    client.from('users').select('*, profiles(*)').order('created_at', { ascending: false }).limit(300),
    client.from('admins').select('user_id'),
  ]);
  return {
    rows: (usersData ?? []) as AdminUserListRow[],
    adminIds: new Set((admData ?? []).map((r) => r.user_id as string)),
    error: uErr?.message ?? null,
  };
}

export async function saveAdminUserEdits(
  userId: string,
  patch: {
    account_status: AccountStatus;
    verification_status: UserVerification;
    boost_credits: number;
    display_name: string;
    bio: string;
    verified_badge: boolean;
    is_profile_public: boolean;
  },
  existingProfile: DbProfile | null
) {
  const client = createClient();
  const { error: uErr } = await client
    .from('users')
    .update({
      account_status: patch.account_status,
      verification_status: patch.verification_status,
      boost_credits: patch.boost_credits,
    })
    .eq('id', userId);
  if (uErr) return { error: uErr.message };
  if (existingProfile) {
    const { error: pErr } = await client
      .from('profiles')
      .update({
        display_name: patch.display_name.trim() || null,
        bio: patch.bio.trim() || null,
        verified_badge: patch.verified_badge,
        is_profile_public: patch.is_profile_public,
      })
      .eq('user_id', userId);
    if (pErr) return { error: pErr.message };
  } else {
    const { error: insErr } = await client.from('profiles').insert({
      user_id: userId,
      display_name: patch.display_name.trim() || null,
      bio: patch.bio.trim() || null,
      verified_badge: patch.verified_badge,
      is_profile_public: patch.is_profile_public,
      preferences: {},
    });
    if (insErr) return { error: insErr.message };
  }
  return { error: null };
}

export async function suspendAdminUser(userId: string) {
  const client = createClient();
  return client.from('users').update({ account_status: 'suspended' }).eq('id', userId);
}

export async function loadAdminPlans() {
  const client = createClient();
  return client.from('plans').select('*').order('created_at', { ascending: false }).limit(150);
}

export async function archiveAdminPlan(id: string) {
  const client = createClient();
  return client.from('plans').update({ archived_at: new Date().toISOString() }).eq('id', id);
}

export async function unarchiveAdminPlan(id: string) {
  const client = createClient();
  return client.from('plans').update({ archived_at: null }).eq('id', id);
}

export async function deleteAdminPlan(id: string) {
  const client = createClient();
  return client.from('plans').delete().eq('id', id);
}

export async function togglePlanSuppress(id: string, on: boolean) {
  const client = createClient();
  return client.from('plans').update({ is_suppressed: on }).eq('id', id);
}

export async function resolveEscrowDispute(disputeId: string, note?: string) {
  const client = createClient();
  return client
    .from('escrow_disputes')
    .update({
      status: 'resolved',
      admin_resolution: note?.trim() || 'Resolved in admin dashboard',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', disputeId);
}

export function isPlanExpired(p: DbPlan): boolean {
  return (
    !!p.is_expired ||
    (!!p.is_mood_plan && !!p.mood_expires_at && new Date(p.mood_expires_at).getTime() <= Date.now())
  );
}
