import type { DbMeetType } from '@/types/database';

/** Catalog / seeded meet types have `created_by` NULL (includes admin-managed catalog). */
export function isCatalogMeetType(type: DbMeetType): boolean {
  return !type.created_by;
}

/** Whether the signed-in user may edit/delete this meet type in plan create UI. */
export function canUserManageMeetType(type: DbMeetType, userId: string | undefined): boolean {
  if (!userId || type.is_admin_managed) return false;
  return !!type.created_by && type.created_by === userId;
}

/** Default catalog types plus types the signed-in user created — excludes other users' custom types. */
export function filterMeetTypesVisibleToUser(
  rows: DbMeetType[],
  userId: string | undefined
): DbMeetType[] {
  return rows.filter((t) => isCatalogMeetType(t) || (!!userId && t.created_by === userId));
}

/** User-owned custom type awaiting admin approval — visible but not selectable. */
export function isPendingMeetType(type: DbMeetType, userId: string | undefined): boolean {
  return type.approval_status === 'pending' && !!userId && type.created_by === userId;
}

export function selectableMeetTypes(rows: DbMeetType[], userId: string | undefined): DbMeetType[] {
  return rows.filter((t) => !isPendingMeetType(t, userId));
}
