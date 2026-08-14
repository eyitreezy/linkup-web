'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { IoPeopleOutline } from 'react-icons/io5';

type Props = {
  planId: string;
  initialCount?: number;
  totalCapacity: number;
  minimumCount?: number;
};

export function GroupPlanMemberCountBadge({
  planId,
  initialCount = 0,
  totalCapacity,
  minimumCount = 5,
}: Props) {
  const [count, setCount] = useState(initialCount);
  const [capacity, setCapacity] = useState(totalCapacity);
  const [minimum, setMinimum] = useState(minimumCount);

  useEffect(() => {
    setCount(initialCount);
    setCapacity(totalCapacity);
    setMinimum(minimumCount);
  }, [initialCount, totalCapacity, minimumCount]);

  useEffect(() => {
    const client = createClient();
    const channel = client
      .channel(`plan-members:${planId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'plans',
          filter: `id=eq.${planId}`,
        },
        (payload) => {
          const row = payload.new as {
            accepted_guest_count?: number;
            max_guests?: number;
            minimum_member_count?: number;
          };
          if (row.accepted_guest_count != null) setCount(row.accepted_guest_count);
          if (row.max_guests != null) setCapacity(row.max_guests + 1);
          if (row.minimum_member_count != null) setMinimum(row.minimum_member_count);
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [planId]);

  const belowMinimum = count < minimum;
  const displayCapacity = Math.max(capacity, 1);

  return (
    <div className="inline-flex flex-col gap-1">
      <div
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-extrabold ${
          belowMinimum ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
        }`}
      >
        <IoPeopleOutline size={14} />
        {count} of {displayCapacity} members confirmed
      </div>
      {belowMinimum ? (
        <span className="text-[11px] font-semibold text-amber-800">
          Minimum {minimum} required
        </span>
      ) : null}
    </div>
  );
}
