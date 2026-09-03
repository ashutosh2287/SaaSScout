/**
 * Request ID middleware (STEP 30).
 *
 * Every request receives a fresh, cryptographically strong ID (crypto.randomUUID)
 * stored on the Hono context and echoed back as the `X-Request-ID` response
 * header.
 *
 * An incoming `X-Request-ID` header is deliberately NOT trusted or echoed.
 * Rationale:
 *   - It prevents log/header injection: a client-supplied arbitrary value can
 *     never be written verbatim into logs or headers (no CR/LF or control
 *     characters can be smuggled through a randomUUID).
 *   - It prevents spoofing/collision in shared logs.
 *
 * The ID never contains transaction, merchant, amount, date, report, file, or
 * any user data — it is a pure random correlation token for observability only.
 */
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "./context.js";

export const REQUEST_ID_HEADER = "X-Request-ID";

/** Attach a fresh request ID to the context and echo it as a response header. */
export const requestIdMiddleware: MiddlewareHandler<AppEnv> = (c, next) => {
  const id = crypto.randomUUID();
  c.set("requestId", id);
  c.header(REQUEST_ID_HEADER, id);
  return next();
};
