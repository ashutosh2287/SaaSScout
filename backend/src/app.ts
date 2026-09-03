import { createHono } from "./context.js";
import { requestIdMiddleware, REQUEST_ID_HEADER } from "./requestId.js";
import { securityHeadersMiddleware } from "./headers.js";
import { loggerMiddleware } from "./logger.js";
import { createRateLimiter } from "./rateLimit.js";

// ---------------------------------------------------------------------------
// Graceful shutdown is wired in src/index.ts (process signals) via the pure
// handler in src/shutdown.ts.
// ---------------------------------------------------------------------------

// Development-safe CORS (preserved from prior steps; not weakened).
//
// Origins are explicit and never a wildcard: future endpoints may carry
// credentials, so a permissive wildcard here would be a security risk. Defaults
// cover the local Next.js dev server; override with CORS_ORIGIN (a
// comma-separated allow-list) when the frontend is served from another origin.
const DEFAULT_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

function allowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) return DEFAULT_ORIGINS;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const ALLOWED = allowedOrigins();

// Rate-limiting defaults (STEP 30). Conservative for a health-only backend: the
// frontend makes one health call per page load, so a generous per-window cap
// never interferes with normal use while still bounding abuse. Overridable via
// env for staging/production deployment tuning.
function numberFromEnv(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
const RATE_LIMIT_WINDOW_MS = numberFromEnv(
  process.env.RATE_LIMIT_WINDOW_MS,
  60_000,
);
const RATE_LIMIT_MAX = numberFromEnv(process.env.RATE_LIMIT_MAX, 120);

// Uniform JSON error envelope shared by every error response.
export type ApiErrorBody = {
  error: { message: string; code: string };
};

export const app = createHono();

// Middleware order matters:
//   1. requestId  — every handler/log line has a correlation ID downstream.
//   2. headers    — security headers on ALL responses, including OPTIONS 204
//      (registered before CORS so its short-circuit still carries them).
//   3. CORS       — preserved explicit allow-list (no wildcard).
//   4. rateLimit  — bounded abuse protection (429 + Retry-After).
//   5. logger     — LAST so it observes the final status (incl. 429/404/500).
app.use("*", requestIdMiddleware);
app.use("*", securityHeadersMiddleware);
app.use(
  "*",
  createRateLimiter({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
  }).middleware,
);

// CORS middleware: echo an allow-listed Origin only; never fall back to "*".
app.use("*", async (c, next) => {
  const origin = c.req.header("Origin");
  if (origin && ALLOWED.includes(origin)) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Vary", "Origin");
    c.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type");
  }
  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }
  await next();
});

app.use("*", loggerMiddleware);

// Health check (preserved). Returns only non-sensitive service status. The HTTP
// handler never receives or echoes transaction data, request headers,
// environment variables, filesystem paths, or credentials.
const healthResponse = { status: "ok" as const };
app.get("/health", (c) => c.json(healthResponse));

// API versioning seam (STEP 30). Establishes the /api/v1 namespace WITHOUT
// inventing business endpoints. /api/v1/health mirrors /health so versioned
// and legacy probes are equivalent. The frontend keeps using /health; this
// seam only guarantees a stable future namespace.
const apiV1 = createHono();
apiV1.get("/health", (c) => c.json(healthResponse));
app.route("/api/v1", apiV1);

// Standardized JSON 404 for unknown API routes.
app.notFound((c) =>
  c.json<ApiErrorBody>(
    { error: { message: "Not found", code: "NOT_FOUND" } },
    404,
  ),
);

// Safe error handler: never leaks stack traces, internals, or sensitive
// details to the client. The original error is logged server-side only, tagged
// with the requestId for correlation. Request bodies and headers are never
// logged or echoed.
app.onError((err, c) => {
  console.error(
    JSON.stringify({
      event: "unhandled_error",
      requestId: c.get("requestId") ?? "unknown",
      path: c.req.path,
    }),
  );
  console.error(err);
  return c.json<ApiErrorBody>(
    { error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
    500,
  );
});

// Export the request-id header name for tests and documentation.
export { REQUEST_ID_HEADER };
