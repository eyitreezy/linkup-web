import { NextResponse } from 'next/server';

/** Public VAPID key for Web Push subscribe (safe to expose to browsers). */
export function getVapidPublicKey(): string {
  return (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY ?? '').trim();
}

export async function GET() {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return NextResponse.json(
      { publicKey: null, configured: false },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  return NextResponse.json(
    { publicKey, configured: true },
    { headers: { 'Cache-Control': 'private, max-age=3600' } }
  );
}
