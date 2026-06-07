/** Insert a friendly “around {city}” line into the composer (mirrors mobile chat Place action). */
export async function suggestMeetingAreaLine(): Promise<{ line: string | null; error: string | null }> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return { line: null, error: 'Location is not available in this browser.' };
  }

  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 12_000,
      maximumAge: 60_000,
    });
  }).catch(() => null);

  if (!pos) {
    return { line: null, error: 'Could not read your location. Allow location access and try again.' };
  }

  const { latitude, longitude } = pos.coords;
  try {
    const res = await fetch(
      `/api/places/reverse-geocode?lat=${encodeURIComponent(String(latitude))}&lng=${encodeURIComponent(String(longitude))}`
    );
    const json = (await res.json()) as { label?: string | null; status?: string };
    const label = json.label?.trim();
    const line = label
      ? `I'm usually around ${label} — happy to meet somewhere public nearby.`
      : `I'm nearby — let's pick a public spot that works for both of us.`;
    return { line, error: null };
  } catch {
    return {
      line: `I'm nearby — let's pick a public spot that works for both of us.`,
      error: null,
    };
  }
}
