/** Public env — same Supabase project as LinkUp mobile. */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  /** App URL for Flutterwave redirect targets (falls back to site URL). */
  appUrl: (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'http://localhost:3000'
  ).replace(/\/$/, ''),
  /** Must match the URL in your browser and Supabase → Auth → URL Configuration. */
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  googleMapsWebApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_WEB_API_KEY ?? '',
} as const;

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
