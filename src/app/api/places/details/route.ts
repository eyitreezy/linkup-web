import { getGoogleMapsServerApiKey, getGoogleMapsWebApiKey } from '@/lib/maps/config';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const key = getGoogleMapsServerApiKey() || getGoogleMapsWebApiKey();
  if (!key) {
    return NextResponse.json({ result: null }, { status: 200 });
  }

  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get('place_id');
  if (!placeId) {
    return NextResponse.json({ error: 'place_id required' }, { status: 400 });
  }

  const url =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${encodeURIComponent(placeId)}` +
    `&fields=formatted_address,geometry` +
    `&key=${encodeURIComponent(key)}`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    return NextResponse.json(json);
  } catch {
    return NextResponse.json({ status: 'NETWORK_ERROR', result: null }, { status: 200 });
  }
}
