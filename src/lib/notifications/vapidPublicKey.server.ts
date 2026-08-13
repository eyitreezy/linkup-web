/** Server-only VAPID public key lookup for API routes. */
export function getVapidPublicKey(): string {
  return (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY ?? '').trim();
}
