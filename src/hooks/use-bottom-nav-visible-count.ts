'use client';

import { bottomNavMaxVisibleForWidth } from '@/components/navigation/tabNavConfig';
import { useEffect, useState } from 'react';

export function useBottomNavVisibleCount() {
  const [maxVisible, setMaxVisible] = useState(5);

  useEffect(() => {
    const update = () => setMaxVisible(bottomNavMaxVisibleForWidth(window.innerWidth));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return maxVisible;
}
