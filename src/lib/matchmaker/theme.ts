/** MatchMaker scoped tokens — do not override global CSS variables. */
export const MATCHMAKER_THEME = {
  primary: '#6C63FF',
  accent: '#9B1B4B',
  background: '#FDF8F4',
  surface: '#FFFFFF',
  surfaceWarm: '#FBF5F0',
  border: '#EDE0D4',
  textPrimary: '#1A1D26',
  textMuted: '#7B6E65',
  disabled: '#C8BDB8',
  ctaGradient: 'linear-gradient(135deg, #6C63FF 0%, #8B84FF 50%, #9B1B4B 100%)',
  slideInMs: 320,
  slideOutMs: 280,
  slideEasing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
} as const;

export function matchmakerScreenClass(): string {
  return 'min-h-full bg-[#FDF8F4] text-[#1A1D26]';
}

