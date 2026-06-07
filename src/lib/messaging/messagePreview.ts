export function messageDisplayText(m: {
  text?: string | null;
  body?: string | null;
  deleted_at?: string | null;
}): string | null {
  if (m.deleted_at) return null;
  return m.text ?? m.body ?? null;
}

export function parseLegacyImageBody(body: string | null): string | null {
  if (!body) return null;
  const m = /^\[image\]\s+(.+)$/i.exec(body.trim());
  return m ? m[1].trim() : null;
}

export function previewForLastMessage(
  body: string | null,
  mediaKind: 'image' | 'video' | null,
  deletedAt?: string | null
): string {
  if (deletedAt) return 'Message deleted';
  const legacy = parseLegacyImageBody(body);
  if (legacy) return 'Sent a photo';
  if (mediaKind === 'video' && !body?.trim()) return 'Sent a video';
  if (mediaKind === 'image' && !body?.trim()) return 'Sent a photo';
  if (mediaKind && body?.trim()) return body.trim();
  return body?.trim()?.slice(0, 140) ?? 'Say hello 👋';
}
