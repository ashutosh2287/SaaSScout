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
 */
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "./context.js";

/** The security headers applied to every response. Pure data for tests. */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store",
};

export const securityHeadersMiddleware: MiddlewareHandler<AppEnv> = (c, next) => {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    c.header(name, value);
  }
  return next();
};
