import { createClient } from '@/lib/supabase/client';
import type { DbVerificationRequest } from '@/types/database';
import type { KycDocumentType } from '@/types/kyc';

const BUCKET = 'verification';

export async function fetchLatestVerificationRequest(
  userId: string
): Promise<DbVerificationRequest | null> {
  const client = createClient();
  const { data, error } = await client
    .from('verification_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as DbVerificationRequest;
}

async function uploadFile(userId: string, file: File, prefix: string): Promise<{ path: string; error: string | null }> {
  const client = createClient();
  const ext = file.type.includes('video') ? 'mp4' : file.type.includes('png') ? 'png' : 'jpg';
  const path = `${userId}/${prefix}-${Date.now()}.${ext}`;
  const { error } = await client.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || (ext === 'mp4' ? 'video/mp4' : 'image/jpeg'),
    upsert: true,
  });
  if (error) return { path, error: error.message };
  return { path, error: null };
}

export async function submitVerificationBundle(args: {
  userId: string;
  idFile: File;
  videoFile: File;
  countryCode: string | null;
  documentType: KycDocumentType;
  consentAtIso: string;
}): Promise<{ error: string | null }> {
  const client = createClient();

  const upId = await uploadFile(args.userId, args.idFile, 'id');
  if (upId.error) return { error: upId.error };

  const upVid = await uploadFile(args.userId, args.videoFile, 'liveness');
  if (upVid.error) return { error: upVid.error };

  const { error: insErr } = await client.from('verification_requests').insert({
    user_id: args.userId,
    status: 'pending',
    id_document_path: upId.path,
    selfie_video_path: upVid.path,
    document_type: args.documentType,
    country_code: args.countryCode,
    consent_at: args.consentAtIso,
    ai_analysis: {
      pipeline: 'vendor_pending',
      submitted_at: new Date().toISOString(),
      note: 'Awaiting automated and manual identity checks.',
    },
  });
  if (insErr) return { error: insErr.message };

  const { error: uErr } = await client
    .from('users')
    .update({ verification_status: 'pending' })
    .eq('id', args.userId);
  if (uErr) return { error: uErr.message };

  return { error: null };
}
