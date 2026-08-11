export type ProfileMediaType = 'photo' | 'video';

export type ProfilePhotoDraftItem = {
  clientId: string;
  url: string | null;
  localFile?: File;
  isPrimary: boolean;
  storagePath?: string;
};

export type ProfileVideoDraft = {
  id?: string;
  url: string | null;
  localFile?: File;
  storagePath?: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
};

export type ProfileMediaDraft = {
  photos: ProfilePhotoDraftItem[];
  videos: ProfileVideoDraft[];
};

export type DbProfileVideo = {
  id: string;
  url: string;
  storagePath: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  mimeType: string | null;
};
