/**
 * Catalog meet-type Meetr tiles — served from `public/meetr-images/`.
 * Source of truth: `linkup/assets/meetr-images/` (copy updates here with same filenames).
 */
const MEETR_CATALOG_COVER_FILES: Record<string, string> = {
  dinner: 'dinner.jpg',
  gym: 'gym.jpg',
  mood: 'mood.jpg',
  casual: 'casual.jpg',
  hangout: 'hangout.jpg',
  group: 'group.jpg',
};

const DEFAULT_MEETR_COVER_FILE = 'default.jpg';

export function meetTypeCatalogCoverPath(slug: string): string {
  const file = MEETR_CATALOG_COVER_FILES[slug] ?? DEFAULT_MEETR_COVER_FILE;
  return `/meetr-images/${file}`;
}

/** @alias meetTypeCatalogCoverPath */
export function meetTypeCatalogCoverUrl(slug: string): string {
  return meetTypeCatalogCoverPath(slug);
}
