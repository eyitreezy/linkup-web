import type { PolicyTableRow } from '@/lib/plans/cancellationPolicy';
import { createClient } from '@/lib/supabase/client';

export type CancellationMatrixRow = {
  plan_type: string;
  escrow_pattern: string;
  timing_band: string;
  cancelling_party: string;
  canceller_refund_percent: number;
  other_party_penalty_percent: number;
  other_party_goodwill_credit: string;
  trust_strikes: number;
  visibility_reduction_percent: number;
  visibility_reduction_days: number;
  creation_hold_days: number;
  requires_admin_review: boolean;
};

const TIMING_LABELS: Record<string, string> = {
  '72h_plus': '72+ hours before meetup',
  '48_72h': '48-72 hours before meetup',
  '24_48h': '24-48 hours before meetup',
  within_24h: 'Under 24 hours before meetup',
  no_show_emergency: 'No-show (emergency reported)',
  no_show_no_contact: 'No-show (no contact)',
};

function bandTone(band: string): PolicyTableRow['tone'] {
  if (band === '72h_plus') return 'ok';
  if (band.startsWith('no_show')) return 'warn';
  return 'muted';
}

export function matrixRowsToPolicyTable(rows: CancellationMatrixRow[]): PolicyTableRow[] {
  return rows.map((row) => {
    const label = TIMING_LABELS[row.timing_band] ?? row.timing_band;
    const goodwill =
      row.other_party_goodwill_credit !== 'none'
        ? ` · ${row.other_party_goodwill_credit} goodwill`
        : '';
    const strikes =
      row.trust_strikes > 0 ? ` · ${row.trust_strikes} strike${row.trust_strikes > 1 ? 's' : ''}` : '';
    return {
      label,
      value: `Canceller ${row.canceller_refund_percent}% refund · Other party ${row.other_party_penalty_percent}% penalty${goodwill}${strikes}`,
      tone: bandTone(row.timing_band),
    };
  });
}

export async function fetchCancellationMatrixRows(opts: {
  planType: 'standard' | 'mood' | 'group';
  escrowPattern: string;
  cancellingParty?: 'host' | 'guest' | 'either';
}): Promise<PolicyTableRow[]> {
  const client = createClient();
  let query = client
    .from('cancellation_matrix')
    .select('*')
    .eq('plan_type', opts.planType)
    .eq('escrow_pattern', opts.escrowPattern);

  if (opts.cancellingParty) {
    query = query.in('cancelling_party', [opts.cancellingParty, 'either']);
  }

  const { data, error } = await query.order('timing_band');
  if (error || !data?.length) return [];
  return matrixRowsToPolicyTable(data as CancellationMatrixRow[]);
}

export async function fetchNoShowMatrixRows(opts: {
  planType: 'standard' | 'mood' | 'group';
  escrowPattern: string;
  cancellingParty?: 'host' | 'guest' | 'either';
}): Promise<PolicyTableRow[]> {
  const client = createClient();
  let query = client
    .from('cancellation_matrix')
    .select('*')
    .eq('plan_type', opts.planType)
    .eq('escrow_pattern', opts.escrowPattern)
    .in('timing_band', ['no_show_emergency', 'no_show_no_contact']);

  if (opts.cancellingParty) {
    query = query.in('cancelling_party', [opts.cancellingParty, 'either']);
  }

  const { data } = await query.order('timing_band');
  if (!data?.length) return [];
  return matrixRowsToPolicyTable(data as CancellationMatrixRow[]);
}
