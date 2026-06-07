'use client';

import { useEffect, useState } from 'react';

/** True after the first client commit — use to gate browser-only UI and avoid hydration mismatches. */
export function useHasMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
