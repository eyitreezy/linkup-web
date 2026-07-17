export { getReleaseRecipientLabel } from '@/lib/escrow/releaseCopy';

/** Format NGN amounts from kobo. */
export function formatNGN(amountCents: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amountCents) / 100);
}

export function escrowStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending_funding: 'Awaiting payment',
    funded: 'Funded',
    active: 'Active',
    released: 'Released',
    disputed: 'In dispute',
    refunded: 'Refunded',
    cancelled: 'Cancelled',
  };
  return labels[status] ?? status.replace(/_/g, ' ');
}

export function formatEscrowDate(iso: string | null | undefined): string {
  if (!iso) return 'Not set';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
