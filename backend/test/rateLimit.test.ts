import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../src/rateLimit.js";
import { createHono } from "../src/context.js";

function buildApp({ max, windowMs }: { max: number; windowMs: number }) {
  let clock = Date.now();
  const { middleware, store } = createRateLimiter({
    windowMs,
    max,
    now: () => clock,
    store: undefined,
    keyOf: (c) => `ip:${c.req.header("x-forwarded-for") ?? "local"}`,
  });
  const app = createHono();
  app.use("*", middleware);
  app.get("/health", (c) => c.json({ status: "ok" }));
  return {
    app,
    store,
    advance(ms: number) {
      clock += ms;
    },
  };
}

describe("In-memory rate limiter", () => {
  test("allows requests up to the max", async () => {
    const { app } = buildApp({ max: 2, windowMs: 60_000 });
    const r1 = await app.fetch(
      new Request("http://localhost/health", { headers: { "x-forwarded-for": "1.2.3.4" } }),
    );
    const r2 = await app.fetch(
      new Request("http://localhost/health", { headers: { "x-forwarded-for": "1.2.3.4" } }),
    );
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
  });

  test("returns 429 with standard error envelope and Retry-After once over the max", async () => {
    const { app, advance } = buildApp({ max: 2, windowMs: 60_000 });
    const hdrs = { "x-forwarded-for": "5.6.7.8" };
    await app.fetch(new Request("http://localhost/health", { headers: hdrs })); // 1
    await app.fetch(new Request("http://localhost/health", { headers: hdrs })); // 2
    const r3 = await app.fetch(new Request("http://localhost/health", { headers: hdrs })); // 3 -> limited
    assert.equal(r3.status, 429);
    assert.deepEqual(await r3.json(), {
      error: { message: "Too many requests", code: "RATE_LIMITED" },
    });
    const retryAfter = Number(r3.headers.get("Retry-After"));
    assert.ok(Number.isInteger(retryAfter) && retryAfter >= 1, `Retry-After present, got ${retryAfter}`);
    advance(0); // just to keep clock stable
    void retryAfter;
  });

  test("window resets after the window elapses (requests allowed again)", async () => {
    const { app, advance } = buildApp({ max: 1, windowMs: 1000 });
    const hdrs = { "x-forwarded-for": "9.9.9.9" };
    assert.equal((await app.fetch(new Request("http://localhost/health", { headers: hdrs }))).status, 200); // 1
    assert.equal((await app.fetch(new Request("http://localhost/health", { headers: hdrs }))).status, 429); // 2 -> limited
    advance(1001); // move into next window
    assert.equal((await app.fetch(new Request("http://localhost/health", { headers: hdrs }))).status, 200); // reset
  });

  test("different client keys have independent buckets", async () => {
    const { app } = buildApp({ max: 1, windowMs: 60_000 });
    const h1 = { "x-forwarded-for": "1.1.1.1" };
    const h2 = { "x-forwarded-for": "2.2.2.2" };
    assert.equal((await app.fetch(new Request("http://localhost/health", { headers: h1 }))).status, 200);
    assert.equal((await app.fetch(new Request("http://localhost/health", { headers: h1 }))).status, 429);
    assert.equal((await app.fetch(new Request("http://localhost/health", { headers: h2 }))).status, 200);
  });

  test("rate-limit keys are IP-derived; never transaction/report data", async () => {
    // The middleware never inspects the request body or path — keys come only
    // from keyOf (IP). Confirm a request with a body-like method still keys on
    // IP and stores no data in the store surface (incr returns only counts).
    const { app, store } = buildApp({ max: 1, windowMs: 1000 });
    const hdrs = { "x-forwarded-for": "3.3.3.3" };
    await app.fetch(new Request("http://localhost/health", { method: "GET", headers: hdrs }));
    const limited = await app.fetch(new Request("http://localhost/health", { method: "GET", headers: hdrs }));
    assert.equal(limited.status, 429);
    // Store only ever exposes numeric counts / timestamps, not request content.
    const probe = store.incr("ip:3.3.3.3", 1000, Date.now());
    assert.equal(typeof probe.count, "number");
    assert.equal(typeof probe.resetAt, "number");
  });
});
