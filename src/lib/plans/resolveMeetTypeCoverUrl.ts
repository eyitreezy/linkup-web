import { meetTypeCatalogCoverUrl } from '@/lib/plans/meetTypeCatalogCovers';
import type { DbMeetType } from '@/types/database';

/** Prefer Storage URL (`meet_type_images`); fall back to bundled catalog cover by slug. */
export function resolveMeetTypeCoverUrl(type: Pick<DbMeetType, 'slug' | 'meet_type_images'>): string {
  if (type.meet_type_images) {
    return type.meet_type_images;
  }
  return meetTypeCatalogCoverUrl(type.slug);
}
