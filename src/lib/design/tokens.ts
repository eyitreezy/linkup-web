/**
 * LinkUp design tokens — mirrored from mobile `constants/theme.ts`.
 * Web uses the same brand; layout adapts for desktop.
 */
export const colors = {
  primary: '#6C63FF',
  secondary: '#FF6584',
  background: '#F5F6FA',
  surface: '#FFFFFF',
  text: '#1A1D26',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  passAction: '#FF5A5F',
  authGradientTop: '#2D1B4E',
  authGradientMid: '#6C63FF',
  authGradientBottom: '#FF6584',
  authCard: '#FFFFFF',
  authInputBg: '#F8F9FC',
  discoveryGradientTop: '#F5F6FA',
  discoveryGradientMid: '#EDE8FF',
  discoveryGradientBottom: '#FFF5F8',
  overlayDark: 'rgba(26, 29, 38, 0.55)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
  button: 200,
} as const;

export const shadows = {
  card: '0 6px 14px rgba(42, 31, 85, 0.07)',
  cardLg: '0 8px 18px rgba(42, 31, 85, 0.09)',
  premium: '0 12px 32px rgba(108, 99, 255, 0.18)',
} as const;
