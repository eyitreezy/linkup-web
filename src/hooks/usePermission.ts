'use client';

import { checkPermission, clearPermissionCache } from '@/lib/subscription/checkPermission';
import type { PermissionResult } from '@/lib/subscription/types';
import { useAuthStore } from '@/stores/auth-store';
import { useCallback, useEffect, useState } from 'react';

export { clearPermissionCache };

type UsePermissionResult = PermissionResult & {
  loading: boolean;
  refresh: () => Promise<void>;
};

export function usePermission(
  feature: string,
  options?: { checkQuota?: boolean; skip?: boolean }
): UsePermissionResult {
  const userId = useAuthStore((s) => s.user?.id);
  const [loading, setLoading] = useState(!options?.skip);
  const [result, setResult] = useState<PermissionResult>({
    allowed: false,
    effectiveTier: 'FREE',
  });

  const refresh = useCallback(async () => {
    if (options?.skip || !userId) {
      setLoading(false);
      setResult({ allowed: false, effectiveTier: 'FREE' });
      return;
    }
    setLoading(true);
    const next = await checkPermission(userId, feature, { checkQuota: options?.checkQuota });
    setResult(next);
    setLoading(false);
  }, [userId, feature, options?.checkQuota, options?.skip]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    ...result,
    loading,
    refresh,
  };
}
