'use client';

import { LinkUpMap } from '@/components/maps/LinkUpMap';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { IoLocationOutline } from 'react-icons/io5';

type Props = {
  partnerSessionId: string;
  partnerName?: string;
};

export function LiveLocationViewer({ partnerSessionId, partnerName }: Props) {
  const [latestPing, setLatestPing] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const client = createClient();

    void client
      .from('live_location_pings')
      .select('lat, lng')
      .eq('session_id', partnerSessionId)
      .order('pinged_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setLatestPing({ lat: data.lat, lng: data.lng });
      });

    const channel = client
      .channel(`location-pings-${partnerSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_location_pings',
          filter: `session_id=eq.${partnerSessionId}`,
        },
        (payload) => {
          const row = payload.new as { lat: number; lng: number };
          setLatestPing({ lat: row.lat, lng: row.lng });
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [partnerSessionId]);

  if (!latestPing) return null;

  return (
    <div className="mx-2.5 mb-2 rounded-xl border border-emerald-500/30 bg-emerald-50/80 p-3 min-[360px]:mx-3">
      <p className="mb-2 flex items-center gap-1.5 text-[12px] font-extrabold text-emerald-900">
        <IoLocationOutline size={14} />
        {partnerName ? `${partnerName} is sharing live location` : 'Your partner is sharing live location'}
      </p>
      <LinkUpMap latitude={latestPing.lat} longitude={latestPing.lng} height={160} zoom={16} />
      <p className="mt-2 text-[11px] font-semibold text-emerald-800/80">
        Location updates every few seconds. This view is only visible to you.
      </p>
    </div>
  );
}
