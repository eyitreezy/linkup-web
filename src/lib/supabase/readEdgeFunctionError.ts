import { FunctionsHttpError } from '@supabase/supabase-js';

/** Parse JSON error body from a failed Supabase Edge Function invoke. */
export async function readEdgeFunctionErrorBody(
  error: unknown
): Promise<{ error?: string; code?: string } | null> {
  if (!(error instanceof FunctionsHttpError)) return null;
  try {
    return (await error.context.json()) as { error?: string; code?: string };
  } catch {
    return null;
  }
}
