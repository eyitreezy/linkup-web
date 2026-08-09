import { isCoordinateInNigeria } from '@/lib/location/nigeriaBounds';
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
    `&fields=formatted_address,geometry,address_components` +
    `&key=${encodeURIComponent(key)}`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    const loc = json?.result?.geometry?.location;
    if (loc && !isCoordinateInNigeria(loc.lat, loc.lng)) {
      return NextResponse.json({ status: 'ZERO_RESULTS', result: null }, { status: 200 });
    }
    return NextResponse.json(json);
  } catch {
    return NextResponse.json({ status: 'NETWORK_ERROR', result: null }, { status: 200 });
  }
}
