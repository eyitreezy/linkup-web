import { getGoogleMapsServerApiKey, getGoogleMapsWebApiKey } from '@/lib/maps/config';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const key = getGoogleMapsServerApiKey() || getGoogleMapsWebApiKey();
  if (!key) {
    return NextResponse.json({ predictions: [] }, { status: 200 });
  }

  const { searchParams } = new URL(request.url);
  const input = searchParams.get('input')?.trim() ?? '';
  if (input.length < 3) {
    return NextResponse.json({ predictions: [] });
  }

  const url =
    `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
    `?input=${encodeURIComponent(input)}` +
    `&key=${encodeURIComponent(key)}`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    return NextResponse.json(json);
  } catch {
    return NextResponse.json({ status: 'NETWORK_ERROR', predictions: [] }, { status: 200 });
  }
}
