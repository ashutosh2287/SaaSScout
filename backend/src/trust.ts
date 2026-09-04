/**
 * Trusted reverse-proxy boundary (STEP 31).
 *
 * Sasscout's backend is designed to sit behind a TLS-terminating reverse proxy
 * that sets the real client IP. This module defines the ONLY place that decides
 * whether forwarding headers may be trusted, so the rest of the app never has to
 * reason about spoofed `X-Forwarded-*` values.
 *
 * Trust model:
 *   - `TRUST_PROXY=false` (default, and the correct setting for any direct /
 *     socket connection): the client IP is the ACTUAL socket peer address from
 *     `getConnInfo` (c.env.incoming.socket.remoteAddress). An attacker sending
 *     a forged `X-Forwarded-For` cannot influence it, so the rate-limit key
 *     cannot be spoofed.
 *   - `TRUST_PROXY=true` (operator-set ONLY when the backend is reachable
 *     exclusively through a controlled reverse proxy): the proxy is responsible
 *     for stripping/replacing any client-supplied forwarding header and setting
 *     `X-Forwarded-For` to the real client IP. We then trust the first entry.
 *     If the backend were directly reachable while this is enabled, that would
 *     be a misconfiguration an attacker could exploit — the operator is
 *     responsible for the network boundary (private network only).
 *
 * The IP is used ONLY as an opaque rate-limiting key. It is never logged as a
 * path, never associated with transaction data, and never exposed to clients.
 */
import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";
import type { AppEnv } from "./context.js";

/** `TRUST_PROXY=true` enables trusting `X-Forwarded-For` from a controlled proxy. */
export function trustProxyEnabled(): boolean {
  return /^(1|true|yes|on)$/i.test(process.env.TRUST_PROXY ?? "");
}

/**
 * The real client IP for a request.
 *
 * Direct connections use the socket peer address (unspoofable). Only when a
 * trusted proxy is explicitly configured do we read the first `X-Forwarded-For`
 * entry. Returns a fallback that never merges distinct direct clients into one
 * bucket.
 */
export function clientIp(c: Context<AppEnv>): string {
  if (trustProxyEnabled()) {
    const fwd = c.req.header("x-forwarded-for");
    if (fwd) {
      const first = fwd.split(",")[0]?.trim();
      if (first) return first;
    }
  }
  try {
    const addr = getConnInfo(c).remote.address;
    if (addr) return String(addr);
  } catch {
    // deliberate fall-through to unknown
  }
  return "unknown";
}
