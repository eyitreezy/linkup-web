/**
 * Browser/server fetch that never throws on network errors (offline, dev server down, CORS abort).
 * Returns null instead of rejecting with TypeError: Failed to fetch.
 */
export async function safeFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response | null> {
  try {
    return await fetch(input, init);
  } catch {
    return null;
  }
}
