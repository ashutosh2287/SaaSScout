/**
 * In-memory fixed-window rate-limiting scaffold (STEP 30).
 *
 * This is a PRODUCTION FOUNDATION, not a distributed limiter. It is:
 *   - process-local (each instance has its own buckets),
 *   - reset on restart (no persistence),
 *   - a scaffold for a future deployment architecture (a shared store like
 *     Redis would be required for distributed enforcement).
 *
 * It uses no Redis, no database, no external services, and no new dependency.
 * It never inspects request bodies and stores no transaction/report/user data —
 * the only keys are client IP-derived identifiers and the current window.
 *
 * Window model: fixed time window. Bucket key = `${clientKey}:${windowKey}`
 * where `windowKey = floor(now / windowMs)`. When the window advances, buckets
 * from two windows ago are swept away, bounding memory to (roughly) the number
 * of distinct clients active in a single window.
 *
 * Limited responses use the standard error envelope (consistent with the rest
 * of the API) and include:
 *   - HTTP 429 Too Many Requests
 *   - `Retry-After` header (retry delay in seconds)
 */

import type { Context, MiddlewareHandler } from "hono";
import type { AppEnv } from "./context.js";
import { clientIp } from "./trust.js";

export type RateLimitStore = {
  /** Increment the bucket for a key/window; returns count and resetAt (ms). */
  incr(key: string, windowMs: number, now: number): { count: number; resetAt: number };
};

function createMapStore(): RateLimitStore {
  const buckets = new Map<string, number>();
  return {
    incr(key, windowMs, now) {
      const windowKey = Math.floor(now / windowMs);
      const resetAt = (windowKey + 1) * windowMs;
      const bucketKey = `${key}:${windowKey}`;
      // Sweep buckets belonging to an expired window (two+ windows old).
      for (const k of buckets.keys()) {
        const sep = k.lastIndexOf(":");
        if (sep === -1) continue;
        const wk = Number(k.slice(sep + 1));
        if (Number.isFinite(wk) && wk < windowKey - 1) buckets.delete(k);
      }
      const count = (buckets.get(bucketKey) ?? 0) + 1;
      buckets.set(bucketKey, count);
      return { count, resetAt };
    },
  };
}

export type RateLimiterOptions = {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Maximum number of requests allowed per window per client key. */
  max: number;
  /** Injectable clock (for deterministic tests). */
  now?: () => number;
  /** Injectable store (for tests). */
  store?: RateLimitStore;
  /** Derive the client key from the request (default: trusted real client IP). */
  keyOf?: (c: Context<AppEnv>) => string;
};

export type RateLimiter = {
  middleware: MiddlewareHandler<AppEnv>;
  store: RateLimitStore;
};

/**
 * Default client key = the trusted real client IP (see src/trust.ts). By
 * default (no trusted proxy) this is the unspoofable socket peer address, so a
 * forged `X-Forwarded-For` cannot rotate/evade the limiter.
 */
function defaultKeyOf(c: Context<AppEnv>): string {
  return clientIp(c);
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { windowMs, max } = options;
  const now = options.now ?? (() => Date.now());
  const store = options.store ?? createMapStore();
  const keyOf = options.keyOf ?? defaultKeyOf;

  const middleware: MiddlewareHandler<AppEnv> = async (c, next) => {
    const key = keyOf(c);
    const { count, resetAt } = store.incr(key, windowMs, now());
    if (count > max) {
      const retryAfter = Math.max(1, Math.ceil((resetAt - now()) / 1000));
      c.header("Retry-After", String(retryAfter));
      return c.json(
        { error: { message: "Too many requests", code: "RATE_LIMITED" } },
        429,
      );
    }
    return next();
  };

  return { middleware, store };
}
