/** Minimum allowed value for group plan max_guests (host + guests capacity is max_guests + 1). */
export const MIN_GROUP_MAX_GUESTS = 5;

export function clampGroupMaxGuests(value: number): number {
  if (!Number.isFinite(value)) return MIN_GROUP_MAX_GUESTS;
  return Math.max(MIN_GROUP_MAX_GUESTS, Math.floor(value));
}

export function parseGroupMaxGuestsInput(raw: string, fallback = MIN_GROUP_MAX_GUESTS): number {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return fallback;
  return clampGroupMaxGuests(n);
}

export function validateGroupMaxGuests(value: number | null | undefined): string | null {
  if (value == null || value < MIN_GROUP_MAX_GUESTS) {
    return `Group plans require at least ${MIN_GROUP_MAX_GUESTS} maximum guests.`;
  }
  return null;
}
