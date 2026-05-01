/**
 * Returns the public-facing base URL for the application.
 *
 * Behind a reverse proxy (e.g. Nginx), `request.url` reflects the
 * internal origin (http://localhost:3000). This helper resolves the
 * correct public URL by checking, in order:
 *   1. NEXTAUTH_URL env var (recommended for production)
 *   2. x-forwarded-host + x-forwarded-proto headers
 *   3. Host header
 *   4. Fallback to request.url origin
 */
export function getPublicBaseUrl(request: Request): string {
  const nextAuthUrl = process.env.NEXTAUTH_URL;
  if (nextAuthUrl) {
    return nextAuthUrl.replace(/\/$/, "");
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = request.headers.get("host");
  if (host) {
    const proto = request.url.startsWith("https") ? "https" : "http";
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}
