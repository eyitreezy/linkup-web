'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { IoPeopleOutline } from 'react-icons/io5';

type Props = {
  planId: string;
  initialCount?: number;
  minimumCount?: number;
};

export function GroupPlanMemberCountBadge({ planId, initialCount = 0, minimumCount = 5 }: Props) {
  const [count, setCount] = useState(initialCount);
  const [required, setRequired] = useState(minimumCount);

  useEffect(() => {
    setCount(initialCount);
    setRequired(minimumCount);
  }, [initialCount, minimumCount]);

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
            minimum_member_count?: number;
          };
          if (row.accepted_guest_count != null) setCount(row.accepted_guest_count);
          if (row.minimum_member_count != null) setRequired(row.minimum_member_count);
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [planId]);

  const belowMinimum = count < required;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-extrabold ${
        belowMinimum ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
      }`}
    >
      <IoPeopleOutline size={14} />
      {count} of {required} members confirmed
    </div>
  );
}
