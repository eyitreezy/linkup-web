/** Public profile route for a member — own profile uses /profile. */
export function publicProfileHref(userId: string, viewerUserId?: string | null): string {
  if (viewerUserId && userId === viewerUserId) return '/profile';
  return `/user/${userId}`;
}
