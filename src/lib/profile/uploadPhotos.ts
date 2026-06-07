import { createClient } from '@/lib/supabase/client';

export async function uploadProfilePhotos(userId: string, files: File[]): Promise<string[]> {
  const client = createClient();
  const urls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const ext = files[i].type.includes('png') ? 'png' : 'jpg';
    const path = `${userId}/${Date.now()}-${i}.${ext}`;
    const { error } = await client.storage.from('avatars').upload(path, files[i], {
      contentType: files[i].type || 'image/jpeg',
      upsert: true,
    });
    if (error) throw new Error(error.message);
    const { data } = client.storage.from('avatars').getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}
