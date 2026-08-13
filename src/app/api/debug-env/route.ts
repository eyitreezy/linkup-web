import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export function GET() {
  return NextResponse.json({
    has_vapid: !!process.env.VAPID_PUBLIC_KEY,
    has_next_public: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    vapid_len: (process.env.VAPID_PUBLIC_KEY ?? '').length,
    next_public_len: (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '').length,
  });
}
