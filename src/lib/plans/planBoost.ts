export function isPlanBoostActive(boostedUntil: string | null | undefined): boolean {
  if (!boostedUntil) return false;
  return new Date(boostedUntil).getTime() > Date.now();
}
