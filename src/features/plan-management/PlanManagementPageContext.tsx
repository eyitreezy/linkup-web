'use client';

import type { PlanManagementSection, PlanSortKey } from '@/lib/plans/planManagement';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const SECTION_KEYS: PlanManagementSection[] = [
  'all',
  'active',
  'mood',
  'expired',
  'drafts',
  'archived',
];

const EMPTY_SECTION_COUNTS: Record<PlanManagementSection, number> = {
  all: 0,
  active: 0,
  mood: 0,
  expired: 0,
  drafts: 0,
  archived: 0,
};

function sectionCountsEqual(
  a: Record<PlanManagementSection, number>,
  b: Record<PlanManagementSection, number>
): boolean {
  return SECTION_KEYS.every((k) => a[k] === b[k]);
}

type PlanManagementPageContextValue = {
  section: PlanManagementSection;
  sort: PlanSortKey;
  sectionCounts: Record<PlanManagementSection, number>;
  setSection: (s: PlanManagementSection) => void;
  setSort: (s: PlanSortKey) => void;
  setSectionCounts: (counts: Record<PlanManagementSection, number>) => void;
};

const PlanManagementPageContext = createContext<PlanManagementPageContextValue | null>(null);

export function PlanManagementPageProvider({ children }: { children: ReactNode }) {
  const [section, setSection] = useState<PlanManagementSection>('all');
  const [sort, setSort] = useState<PlanSortKey>('newest');
  const [sectionCounts, setSectionCountsState] =
    useState<Record<PlanManagementSection, number>>(EMPTY_SECTION_COUNTS);

  /** Only commits when chip counts change — avoids rail ↔ screen update loops. */
  const setSectionCounts = useCallback((counts: Record<PlanManagementSection, number>) => {
    setSectionCountsState((prev) => (sectionCountsEqual(prev, counts) ? prev : counts));
  }, []);

  const value = useMemo(
    () => ({
      section,
      sort,
      sectionCounts,
      setSection,
      setSort,
      setSectionCounts,
    }),
    [section, sort, sectionCounts, setSectionCounts]
  );

  return (
    <PlanManagementPageContext.Provider value={value}>{children}</PlanManagementPageContext.Provider>
  );
}

export function usePlanManagementPage() {
  const ctx = useContext(PlanManagementPageContext);
  if (!ctx) {
    throw new Error('usePlanManagementPage must be used within PlanManagementPageProvider');
  }
  return ctx;
}

export function usePlanManagementPageOptional() {
  return useContext(PlanManagementPageContext);
}
