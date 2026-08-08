const RECENT_TRAVEL_KEY = 'linkup_recent_travel_cities';
const MAX_RECENT = 5;

export interface RecentTravelCity {
  label: string;
  latitude: number;
  longitude: number;
  visitedAt: string;
}

export function getRecentTravelCities(): RecentTravelCity[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_TRAVEL_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentTravelCity[];
  } catch {
    return [];
  }
}

export function recordTravelCity(city: {
  label: string;
  latitude: number;
  longitude: number;
}): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getRecentTravelCities();
    const filtered = existing.filter((c) => c.label.toLowerCase() !== city.label.toLowerCase());
    const updated: RecentTravelCity[] = [
      { ...city, visitedAt: new Date().toISOString() },
      ...filtered,
    ].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_TRAVEL_KEY, JSON.stringify(updated));
  } catch {
    // Non-critical
  }
}

export function clearRecentTravelCities(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(RECENT_TRAVEL_KEY);
  } catch {
    // Non-critical
  }
}
