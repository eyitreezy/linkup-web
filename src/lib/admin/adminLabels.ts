/** Shared copy and status styling — mirrors mobile `app/admin/index.tsx`. */

export function shortUuid(id: string, len = 8): string {
  return id.length <= len ? id : `${id.slice(0, len)}…`;
}

export function formatEscrowAmount(cents: number | undefined, currency: string | undefined): string | null {
  if (cents == null || currency == null) return null;
  const major = cents / 100;
  if (currency === 'NGN') return `₦${major.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `${major.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
}

export function kycStatusTone(status: string): 'warn' | 'ok' | 'danger' | 'primary' | 'neutral' {
  if (status === 'pending') return 'warn';
  if (status === 'admin_approved') return 'ok';
  if (status === 'admin_rejected') return 'danger';
  return 'primary';
}

export function reportStatusTone(status: string): 'warn' | 'ok' | 'primary' | 'neutral' {
  if (status === 'pending') return 'warn';
  if (status === 'reviewed') return 'primary';
  if (status === 'resolved') return 'ok';
  return 'neutral';
}

export function escrowStatusTone(status: string): 'warn' | 'ok' | 'primary' | 'neutral' | 'danger' {
  const s = status.toLowerCase();
  if (s === 'open') return 'warn';
  if (s === 'under_review') return 'primary';
  if (s === 'resolved') return 'ok';
  if (s === 'dismissed') return 'neutral';
  return 'neutral';
}

export function ticketStatusTone(status: string): 'warn' | 'ok' | 'primary' | 'neutral' {
  const s = status.toLowerCase();
  if (s === 'open') return 'warn';
  if (s === 'in_progress') return 'primary';
  if (s === 'resolved') return 'ok';
  return 'neutral';
}

export function ticketPriorityTone(priority: string): 'danger' | 'primary' | 'neutral' {
  const p = priority.toLowerCase();
  if (p === 'high' || p === 'urgent') return 'danger';
  if (p === 'low') return 'neutral';
  return 'primary';
}

export function moderationFlagLabel(ft: string): string {
  const map: Record<string, string> = {
    spam: 'Spam / noise',
    abuse: 'Harassment / abuse',
    scam: 'Scam / solicitation',
    explicit: 'Explicit content',
    other: 'Unclassified',
  };
  return map[ft] ?? ft.replace(/_/g, ' ');
}

export function moderationActionLabel(action: string): string {
  const map: Record<string, string> = {
    none: 'No automated action',
    hidden: 'Hidden or blocked',
    warned: 'Warned (account)',
    banned: 'Banned (account)',
  };
  return map[action] ?? action.replace(/_/g, ' ');
}

export function moderationContentLabel(ct: string): string {
  if (ct === 'message') return 'Chat message';
  if (ct === 'plan') return 'Meetup plan';
  if (ct === 'profile') return 'Profile text';
  return ct;
}

export function formatModerationScore(score: number | null): string {
  if (score == null || Number.isNaN(Number(score))) return '—';
  return `${Math.round(Number(score) * 100)}% · heuristic`;
}

export function moderationAuditSummary(item: {
  flag_type: string;
  action_taken: string;
  severity: string;
}): string {
  return `${moderationFlagLabel(item.flag_type)} · ${moderationActionLabel(item.action_taken)} · ${item.severity} severity`;
}
