import { getGoogleMapsWebApiKey } from '@/lib/maps/config';
import { NextResponse } from 'next/server';

type GeocodeResponse = {
  status: string;
  results?: { geometry: { location: { lat: number; lng: number } } }[];
};

export async function GET(request: Request) {
  const key = getGoogleMapsWebApiKey();
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address')?.trim();

  if (!address) {
    return NextResponse.json({ error: 'address required' }, { status: 400 });
  }

  if (!key) {
    return NextResponse.json({ status: 'NO_KEY', result: null }, { status: 200 });
  }

  const url =
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?address=${encodeURIComponent(address)}` +
    `&key=${encodeURIComponent(key)}`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const json = (await res.json()) as GeocodeResponse;

    if (json.status !== 'OK' || !json.results?.[0]?.geometry?.location) {
      return NextResponse.json({ status: json.status ?? 'ERROR', result: null }, { status: 200 });
    }

    const { lat, lng } = json.results[0].geometry.location;
    return NextResponse.json({
      status: 'OK',
      result: { latitude: lat, longitude: lng },
    });
  } catch {
    return NextResponse.json({ status: 'NETWORK_ERROR', result: null }, { status: 200 });
  }
}
