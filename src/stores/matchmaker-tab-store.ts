import { create } from 'zustand';

type MatchMakerTabStore = {
  pulseSeq: number;
  requestTabPulse: () => void;
};

export const useMatchMakerTabStore = create<MatchMakerTabStore>((set) => ({
  pulseSeq: 0,
  requestTabPulse: () => set((s) => ({ pulseSeq: s.pulseSeq + 1 })),
}));

/** True when user is on active connection journey under MatchMaker tab. */
export function isMatchMakerConnectionTabRoute(pathname: string): boolean {
  return pathname === '/matchmaker' || /^\/matchmaker\/connection\/[^/]+$/.test(pathname);
}
