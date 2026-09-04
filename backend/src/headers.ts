/**
 * Security response headers (STEP 30).
 *
 * Decision: Sasscout's backend is a JSON-only API and serves no HTML, so a
 * browser Content-Security-Policy is deliberately NOT added — CSP protects
 * HTML pages from XSS; for a JSON API it is cargo-culted, not meaningful.
 * HSTS (Strict-Transport-Security) is likewise omitted because it only applies
 * over HTTPS and the local development backend is HTTP by design.
 *
 * Headers that ARE appropriate for a same-origin JSON API:
 *   - X-Content-Type-Options: nosniff   — refuse MIME-sniffing of responses.
 *   - Referrer-Policy: no-referrer       — never leak a referrer on requests
 *                                            made from the API's responses.
 *   - X-Frame-Options: DENY              — defense-in-depth (no HTML, but a
 *                                            zero-cost guard if that changes).
 *   - Cache-Control: no-store            — API responses must not be cached,
 *                                            protecting any future non-public
 *                                            response shape.
 *
 * These headers must not interfere with /health, CORS, or OPTIONS preflight —
 * they are set after the CORS/allowed-origin logic and apply to all routes.
 *
 * HSTS (Strict-Transport-Security) is ADDED conditionally (STEP 31): it is
 * emitted ONLY when `HSTS_ENABLED=true` is set by an operator who knows the
 * deployment is HTTPS behind a trusted reverse proxy. It is deliberately NOT
 * derived from any request header (e.g. `X-Forwarded-Proto`), because an
 * arbitrary client must never be able to force the browser to pin the domain.
 * During ordinary HTTP development `HSTS_ENABLED` is unset, so no HSTS header
 * is sent and localhost is never pinned. `includeSubDomains`/`preload` are
 * intentionally omitted (no documented justification for this project).
 */
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "./context.js";

/** The base security headers applied to every response. Pure data for tests. */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store",
};

/** HSTS header emitted ONLY when HSTS_ENABLED=true (HTTPS production trust). */
export const HSTS_HEADER = "Strict-Transport-Security";
export const HSTS_VALUE = "max-age=31536000";

/** `HSTS_ENABLED=true` → emit the HSTS header. */
export function hstsEnabled(): boolean {
  return /^(1|true|yes|on)$/i.test(process.env.HSTS_ENABLED ?? "");
}

export const securityHeadersMiddleware: MiddlewareHandler<AppEnv> = (c, next) => {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    c.header(name, value);
  }
  if (hstsEnabled()) {
    c.header(HSTS_HEADER, HSTS_VALUE);
  }
  return next();
};
