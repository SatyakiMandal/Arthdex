import "server-only";

/**
 * Headers every server-side call to the data service must carry.
 *
 * When the data service sits behind a gateway that needs a bearer token (for example a
 * private Hugging Face Space), set ARTHDEX_API_TOKEN on the website's host. Unset, no
 * Authorization header is sent, which is what local development uses.
 */
export function backendHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = process.env.ARTHDEX_API_TOKEN;
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}
