import { createClient } from '@/lib/supabase/client';

export async function uploadProfilePhotos(
  userId: string,
  items: { file: File; clientId?: string; index?: number }[]
): Promise<string[]> {
  const client = createClient();
  const urls: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const { file, clientId, index = i } = items[i];
    const ext = file.type.includes('png') ? 'png' : 'jpg';
    const path = clientId
      ? `${userId}/${clientId}.${ext}`
      : `${userId}/${Date.now()}-${index}.${ext}`;
    const { error } = await client.storage.from('avatars').upload(path, file, {
      contentType: file.type || 'image/jpeg',
      upsert: true,
    });
    if (error) throw new Error(error.message);
    const { data } = client.storage.from('avatars').getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}
