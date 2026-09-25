import type { PoolProfileRow } from '@/lib/matchmaker/compatibility';

export type MatchMakerInterestQueueRow = PoolProfileRow & {
  interest_id: string;
  status: 'pending' | 'accepted' | 'passed' | 'expired';
  expressed_at: string;
  expires_at: string;
  opened_at?: string | null;
};

export type MatchMakerInterestQueue = {
  sent: MatchMakerInterestQueueRow[];
  received: MatchMakerInterestQueueRow[];
  receivedCount: number;
  receivedUnopenedCount: number;
};
