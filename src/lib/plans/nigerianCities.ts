/** Nigerian cities for Platinum multi-city group plans. */
export const NIGERIAN_CITIES = [
  { id: 'lagos', label: 'Lagos' },
  { id: 'abuja', label: 'Abuja' },
  { id: 'ph', label: 'Port Harcourt' },
  { id: 'kano', label: 'Kano' },
  { id: 'ibadan', label: 'Ibadan' },
  { id: 'benin', label: 'Benin City' },
  { id: 'enugu', label: 'Enugu' },
  { id: 'kaduna', label: 'Kaduna' },
  { id: 'warri', label: 'Warri' },
  { id: 'calabar', label: 'Calabar' },
] as const;

export type NigerianCityId = (typeof NIGERIAN_CITIES)[number]['id'];

export const MULTI_CITY_MIN = 2;
export const MULTI_CITY_MAX = 5;

const cityById = new Map(NIGERIAN_CITIES.map((c) => [c.id, c]));

export function getNigerianCityLabel(id: string): string {
  return cityById.get(id as NigerianCityId)?.label ?? id;
}

export function filterNigerianCities(
  query: string,
  excludeIds: string[] = []
): (typeof NIGERIAN_CITIES)[number][] {
  const q = query.trim().toLowerCase();
  const excluded = new Set(excludeIds);
  return NIGERIAN_CITIES.filter((city) => {
    if (excluded.has(city.id)) return false;
    if (!q) return true;
    return city.label.toLowerCase().includes(q);
  });
}

export function validateMultiCitySelection(ids: string[]): string | null {
  if (ids.length < MULTI_CITY_MIN) {
    return `Select at least ${MULTI_CITY_MIN} cities (up to ${MULTI_CITY_MAX}).`;
  }
  if (ids.length > MULTI_CITY_MAX) {
    return `You can select at most ${MULTI_CITY_MAX} cities.`;
  }
  const invalid = ids.find((id) => !cityById.has(id as NigerianCityId));
  if (invalid) return 'One or more selected cities are invalid.';
  return null;
}
