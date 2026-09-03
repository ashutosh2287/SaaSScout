/**
 * No-data request logger (STEP 30).
 *
 * POLICY: the backend must NEVER log request bodies, transaction data, merchant
 * names, amounts, dates, uploaded files, reports, cookies, authorization
 * credentials, API keys, secrets, or arbitrary request headers. This logger
 * emits ONLY safe, sanitized correlation metadata:
 *
 *   { requestId, method, path, status, durationMs }
 *
 * - `path` uses Hono's pathname (`c.req.path`), which NEVER includes the query
 *   string — so even a future query string cannot leak into logs.
 * - No headers, no body, no cookies, no environment variables are logged.
 * - Only the already-generated crypto requestId is used; client-supplied IDs
 *   are never trusted or written out.
 *
 * 5xx responses are logged via console.error (for operational visibility);
 * everything else via console.log. Both are single-line JSON strings.
 */
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "./context.js";

type SafeLog = {
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
};

export const loggerMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const start = Date.now();
  await next();
  const log: SafeLog = {
    requestId: c.get("requestId"),
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: Date.now() - start,
  };
  if (c.res.status >= 500) {
    console.error(JSON.stringify(log));
  } else {
    console.log(JSON.stringify(log));
  }
};
