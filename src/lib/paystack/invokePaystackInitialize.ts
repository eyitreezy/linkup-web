import { createClient } from '@/lib/supabase/client';

export type PaystackInitializeResult = {
  authorization_url: string;
  reference: string;
};

type InvokeFail = { ok: false; error: string };
type InvokeOk = { ok: true; data: PaystackInitializeResult };

async function readFunctionErrorBody(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: Response })?.context;
  if (!ctx || typeof ctx.json !== 'function') return null;
  try {
    const body = (await ctx.json()) as { error?: string; message?: string };
    if (typeof body?.error === 'string' && body.error.trim()) return body.error.trim();
    if (typeof body?.message === 'string' && body.message.trim()) return body.message.trim();
  } catch {
    try {
      const text = await ctx.text();
      if (text?.trim() && !text.trim().startsWith('<')) return text.trim().slice(0, 280);
    } catch {
      /* ignore */
    }
  }
  return null;
}

export async function invokePaystackInitialize(
  body: Record<string, unknown>
): Promise<InvokeOk | InvokeFail> {
  const client = createClient();
  const { data, error } = await client.functions.invoke('paystack-initialize', { body });

  const row = data as PaystackInitializeResult & { error?: string } | null;

  if (row?.authorization_url) {
    return {
      ok: true,
      data: {
        authorization_url: row.authorization_url,
        reference: row.reference ?? '',
      },
    };
  }

  if (row?.error) return { ok: false, error: row.error };

  const fromContext = error ? await readFunctionErrorBody(error) : null;
  if (fromContext) return { ok: false, error: fromContext };

  const msg = (error as { message?: string } | null)?.message ?? '';
  if (msg.includes('Failed to send') || msg.includes('FetchError')) {
    return {
      ok: false,
      error: 'Cannot reach payment server. Deploy paystack-initialize on Supabase.',
    };
  }
  if (msg) return { ok: false, error: msg };

  return { ok: false, error: 'Could not start Paystack checkout. Try again in a moment.' };
}
