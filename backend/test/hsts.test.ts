import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/app.js";
import { hstsEnabled, HSTS_HEADER } from "../src/headers.js";

async function hstsHeader(envValue?: string): Promise<string | null> {
  const prev = process.env.HSTS_ENABLED;
  if (envValue === undefined) delete process.env.HSTS_ENABLED;
  else process.env.HSTS_ENABLED = envValue;
  try {
    // Spoofed proto header must never be able to force HSTS.
    const res = await app.fetch(
      new Request("http://localhost/health", {
        headers: { "x-forwarded-proto": "https" },
      }),
    );
    return res.headers.get(HSTS_HEADER);
  } finally {
    if (prev === undefined) delete process.env.HSTS_ENABLED;
    else process.env.HSTS_ENABLED = prev;
  }
}

describe("Conditional HSTS (STEP 31)", () => {
  test("hstsEnabled is false by default (HTTP development is never pinned)", () => {
    const prev = process.env.HSTS_ENABLED;
    delete process.env.HSTS_ENABLED;
    try {
      assert.equal(hstsEnabled(), false);
    } finally {
      if (prev !== undefined) process.env.HSTS_ENABLED = prev;
    }
  });

  test("NO Strict-Transport-Security on ordinary HTTP development requests", async () => {
    assert.equal(await hstsHeader(undefined), null);
  });

  test("HSTS emitted when HSTS_ENABLED=true (operator-confirmed HTTPS deployment)", async () => {
    assert.equal(await hstsHeader("true"), "max-age=31536000");
  });

  test("a spoofed X-Forwarded-Proto cannot enable HSTS (config-driven only)", async () => {
    // Even with a client claiming https, HSTS stays off unless the operator
    // set HSTS_ENABLED. The header is never derived from request input.
    assert.equal(await hstsHeader(undefined), null);
  });

  test("HSTS_ENABLED=false keeps HSTS absent", async () => {
    assert.equal(await hstsHeader("false"), null);
  });
});
