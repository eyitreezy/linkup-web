'use client';

import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery } from '@tanstack/react-query';

export function useAdminAccess() {
  const user = useAuthStore((s) => s.user);

  const query = useQuery({
    queryKey: ['admin-access', user?.id],
    queryFn: async () => {
      if (!user?.id) return { isAdmin: false, adminRecordId: null as string | null };
      const client = createClient();
      const { data } = await client.from('admins').select('id').eq('user_id', user.id).maybeSingle();
      return {
        isAdmin: !!data,
        adminRecordId: (data?.id as string | undefined) ?? null,
      };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });

  return {
    isAdmin: query.data?.isAdmin ?? false,
    adminRecordId: query.data?.adminRecordId ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
