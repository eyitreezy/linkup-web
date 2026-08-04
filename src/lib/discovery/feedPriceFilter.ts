import {
  hasDiscoverPriceFilter,
  normalizeDiscoverPriceCents,
  validateDiscoverPriceRange,
} from '@/lib/discovery/discoverPriceFilter';
export function formatFilterPriceMajor(cents: number | null | undefined): string {
  const normalized = normalizeDiscoverPriceCents(cents);
  if (normalized == null) return '';
  return String(Math.round(normalized / 100));
}

/** Strip non-digits so price filter inputs accept numbers only. */
export function sanitizeFilterPriceInput(text: string): string {
  return text.replace(/\D/g, '');
}

export function parseFilterPriceMajor(text: string): number | null {
  const digits = sanitizeFilterPriceInput(text);
  if (!digits) return null;
  const major = Number.parseInt(digits, 10);
  if (!Number.isFinite(major) || major <= 0) return null;
  return normalizeDiscoverPriceCents(major * 100);
}

export { validateDiscoverPriceRange, hasDiscoverPriceFilter, normalizeDiscoverPriceCents };
