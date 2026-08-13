/** Server-only VAPID public key lookup for API routes. */
export function getVapidPublicKey(): string {
  const fromEnv = (
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
    process.env.VAPID_PUBLIC_KEY ??
    ''
  ).trim();

  // Fallback: hardcoded public key (safe — VAPID public keys are not secret)
  const hardcoded = 'BJ3LqRlrjWZFboxx4Sps7-3LLpJN7sJAwqPbeiTLVpMU1QGuSGJrSxTTVRTRV5lHHCYNQdaGmKsAZWtb5IVmarA';

  return fromEnv || hardcoded;
}
