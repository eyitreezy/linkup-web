import { getVapidPublicKey } from '@/lib/notifications/vapidPublicKey.server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export function GET() {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.json({ publicKey });
}
