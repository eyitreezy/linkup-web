/** Normalize hosted checkout URLs returned by create-subscription / create-escrow-payment. */
export function extractPaymentLink(data: unknown): string | null {
  if (typeof data === 'string') {
    return normalizeCheckoutUrl(data);
  }

  if (!data || typeof data !== 'object') return null;

  const row = data as Record<string, unknown>;

  if (typeof row.error === 'string' && row.error.trim()) {
    throw new Error(row.error);
  }

  const candidates = [
    row.payment_link,
    row.link,
    row.authorization_url,
    (row.data as { link?: unknown } | undefined)?.link,
    typeof row.payment_link === 'object' && row.payment_link !== null
      ? (row.payment_link as { link?: unknown }).link
      : undefined,
  ];

  for (const candidate of candidates) {
    const normalized = extractPaymentLink(candidate);
    if (normalized) return normalized;
  }

  return null;
}

function normalizeCheckoutUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{')) {
    try {
      return extractPaymentLink(JSON.parse(trimmed) as unknown);
    } catch {
      return null;
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^(checkout\.|pay\.|link\.)?flutterwave\./i.test(trimmed) || /^flw\.pub\//i.test(trimmed)) {
    return `https://${trimmed.replace(/^\/+/, '')}`;
  }

  return null;
}

export function isHostedCheckoutUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    if (host.includes('flutterwave') || host.endsWith('.ravepay.co') || host === 'ravepay.co' || host.endsWith('.flw.pub') || host === 'flw.pub') {
      return true;
    }
    return host.endsWith('.paystack.com') || host === 'paystack.com';
  } catch {
    return false;
  }
}
