import { createClient } from '@/lib/supabase/client';

/** Persist primary photo immediately — reorders photo_urls with primary first. */
export async function persistPrimaryPhoto(args: {
  userId: string;
  primaryUrl: string;
  allPhotoUrls: string[];
}): Promise<{ error: string | null }> {
  const primary = args.primaryUrl.trim();
  if (!primary) return { error: 'Invalid photo.' };
  const rest = args.allPhotoUrls.filter((u) => u !== primary);
  const photo_urls = [primary, ...rest];
  const client = createClient();
  const { error } = await client
    .from('profiles')
    .update({
      primary_photo_url: primary,
      avatar_url: primary,
      photo_urls,
    })
    .eq('user_id', args.userId);
  return { error: error?.message ?? null };
}
