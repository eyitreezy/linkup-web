import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, isSupabaseConfigured } from '@/lib/env';

/** Anonymous Supabase client for public pages and OG image generation (no session cookies). */
export function createPublicClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return createClient(env.supabaseUrl, env.supabaseAnonKey);
}
