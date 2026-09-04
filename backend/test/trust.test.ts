import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { clientIp, trustProxyEnabled } from "../src/trust.js";
import { createHono } from "../src/context.js";

/**
 * `clientIp` on a direct `app.fetch` has no socket, so with TRUST_PROXY off it
 * must NOT read the spoofed X-Forwarded-For (returns "unknown"); with it on it
 * reads the first entry. This proves the header cannot bypass the model when
 * the backend is directly reachable.
 */
async function ipFor(env: Record<string, string>, xff?: string): Promise<string> {
  const prev = { ...env };
  for (const k of Object.keys(prev)) delete process.env[k];
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  try {
    const app = createHono();
    app.get("/t", (c) => c.json({ ip: clientIp(c) }));
    const headers: Record<string, string> = {};
    if (xff) headers["x-forwarded-for"] = xff;
    const res = await app.fetch(new Request("http://localhost/t", { headers }));
    return (await res.json()).ip;
  } finally {
    for (const k of Object.keys(process.env)) {
      if (k in prev) process.env[k] = prev[k];
      else delete process.env[k];
    }
  }
}

describe("Trusted reverse-proxy model", () => {
  test("trustProxyEnabled is false by default", async () => {
    const prev = process.env.TRUST_PROXY;
    delete process.env.TRUST_PROXY;
    try {
      assert.equal(trustProxyEnabled(), false);
    } finally {
      if (prev !== undefined) process.env.TRUST_PROXY = prev;
    }
  });

  test("trustProxyEnabled accepts TRUST_PROXY=true/1/yes/on (case-insensitive)", () => {
    for (const v of ["true", "1", "YES", "on", "True"]) {
      const prev = process.env.TRUST_PROXY;
      process.env.TRUST_PROXY = v;
      try {
        assert.equal(trustProxyEnabled(), true, v);
      } finally {
        if (prev !== undefined) process.env.TRUST_PROXY = prev;
        else delete process.env.TRUST_PROXY;
      }
    }
  });

  test("direct request does NOT trust a spoofed X-Forwarded-For (unspoofable socket key)", async () => {
    // TRUST_PROXY off, attacker sends a forged XFF.
    const ip = await ipFor({}, "9.9.9.9, 8.8.8.8");
    assert.notEqual(ip, "9.9.9.9", "must ignore the spoofed header");
    assert.notEqual(ip, "8.8.8.8");
    assert.equal(ip, "unknown"); // no socket in app.fetch -> no forged value used
  });

  test("trusted proxy reads the first X-Forwarded-For entry", async () => {
    const ip = await ipFor({ TRUST_PROXY: "true" }, "10.1.1.50, 192.168.0.1");
    assert.equal(ip, "10.1.1.50");
  });

  test("trusted proxy with no X-Forwarded-For falls back safely (not a forged value)", async () => {
    const ip = await ipFor({ TRUST_PROXY: "true" });
    assert.ok(ip.length > 0);
  });
});
