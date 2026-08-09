import { isCoordinateInNigeria } from '@/lib/location/nigeriaBounds';
import { searchNominatimSuggestions } from '@/lib/location/nominatimSearch';
import { getGoogleMapsServerApiKey, getGoogleMapsWebApiKey } from '@/lib/maps/config';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type GoogleAutocompleteResponse = {
  status?: string;
  predictions?: { description: string; place_id: string }[];
};

async function googlePredictions(input: string, key: string) {
  const params = new URLSearchParams({
    input,
    key,
    location: '6.5244,3.3792',
    radius: '1000000',
    components: 'country:ng',
  });

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`
  );
  const json = (await res.json()) as GoogleAutocompleteResponse;
  if (json.status !== 'OK' || !json.predictions?.length) return [];
  return json.predictions;
}

function toPayload(
  rows: { description: string; place_id: string; latitude?: number; longitude?: number }[],
  source: 'google' | 'nominatim'
) {
  return NextResponse.json({
    status: rows.length > 0 ? 'OK' : 'ZERO_RESULTS',
    source,
    predictions: rows,
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get('input')?.trim() ?? '';
  if (input.length < 3) {
    return NextResponse.json({ status: 'INVALID_REQUEST', predictions: [] });
  }

  const googleKey = getGoogleMapsServerApiKey() || getGoogleMapsWebApiKey();

  if (googleKey) {
    try {
      const googleRows = await googlePredictions(input, googleKey);
      if (googleRows.length > 0) {
        return toPayload(googleRows, 'google');
      }
    } catch {
      /* fall through */
    }
  }

  const nominatim = await searchNominatimSuggestions(input, 8);
  const filtered = nominatim.filter((row) => isCoordinateInNigeria(row.latitude, row.longitude));
  return toPayload(
    filtered.map((row) => ({
      description: row.label,
      place_id: row.placeId ?? row.label,
      latitude: row.latitude,
      longitude: row.longitude,
    })),
    'nominatim'
  );
}
