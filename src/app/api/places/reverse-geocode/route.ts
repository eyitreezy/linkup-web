import { getGoogleMapsWebApiKey } from '@/lib/maps/config';
import { NextResponse } from 'next/server';

type GeocodeResponse = {
  status: string;
  results?: {
    formatted_address?: string;
    address_components?: { long_name: string; types: string[] }[];
  }[];
};

export async function GET(request: Request) {
  const key = getGoogleMapsWebApiKey();
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  if (!key) {
    return NextResponse.json({ status: 'NO_KEY', label: null }, { status: 200 });
  }

  const url =
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?latlng=${encodeURIComponent(lat)},${encodeURIComponent(lng)}` +
    `&key=${encodeURIComponent(key)}`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const json = (await res.json()) as GeocodeResponse;

    if (json.status !== 'OK' || !json.results?.[0]) {
      return NextResponse.json({ status: json.status ?? 'ERROR', label: null }, { status: 200 });
    }

    const comps = json.results[0].address_components ?? [];
    const city = comps.find((c) => c.types.includes('locality'))?.long_name;
    const region = comps.find((c) => c.types.includes('administrative_area_level_1'))?.long_name;
    const label =
      [city, region].filter(Boolean).join(', ') || json.results[0].formatted_address || null;

    return NextResponse.json({ status: 'OK', label });
  } catch {
    return NextResponse.json({ status: 'NETWORK_ERROR', label: null }, { status: 200 });
  }
}
