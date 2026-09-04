import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../src/rateLimit.js";
import { createHono } from "../src/context.js";

/**
 * Uses the limiter's DEFAULT keyOf (the trusted real client IP from src/trust.ts)
 * to prove the STEP 31 spoofing-prevention property:
 *   - TRUST_PROXY off: rotating spoofed X-Forwarded-For headers must NOT give
 *     fresh buckets — all resolve to the (absent) socket key "unknown".
 *   - TRUST_PROXY on: distinct X-Forwarded-For IPs get independent buckets.
 */
describe("Real-IP rate-limit key (STEP 31)", () => {
  async function run(env: Record<string, string>, headersList: Array<Record<string, string>>) {
    const prev = { ...env };
    for (const k of Object.keys(prev)) delete process.env[k];
    for (const [k, v] of Object.entries(env)) process.env[k] = v;
    try {
      const { middleware } = createRateLimiter({ max: 1, windowMs: 60_000 });
      const app = createHono();
      app.use("*", middleware);
      app.get("/health", (c) => c.json({ status: "ok" }));
      const statuses: number[] = [];
      for (const headers of headersList) {
        statuses.push((await app.fetch(new Request("http://localhost/health", { headers }))).status);
      }
      return statuses;
    } finally {
      for (const k of Object.keys(process.env)) {
        if (k in prev) process.env[k] = prev[k];
        else delete process.env[k];
      }
    }
  }

  test("TRUST_PROXY OFF: rotating spoofed X-Forwarded-For cannot bypass the limiter", async () => {
    // Same socket (absent in app.fetch -> one key), even though the attacker
    // presents a different XFF each time. Second request must be limited.
    const statuses = await run(
      {},
      [
        { "x-forwarded-for": "1.1.1.1" },
        { "x-forwarded-for": "2.2.2.2" },
        { "x-forwarded-for": "3.3.3.3" },
      ],
    );
    assert.deepEqual(statuses, [200, 429, 429]);
  });

  test("TRUST_PROXY ON: distinct X-Forwarded-For IPs have independent buckets", async () => {
    const statuses = await run(
      { TRUST_PROXY: "true" },
      [
        { "x-forwarded-for": "10.1.1.1" },
        { "x-forwarded-for": "10.1.1.1" },
        { "x-forwarded-for": "10.1.1.2" },
      ],
    );
    assert.deepEqual(statuses, [200, 429, 200]);
  });
});
