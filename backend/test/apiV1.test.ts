import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/app.js";

describe("/api/v1 readiness seam", () => {
  test("/api/v1/health returns the same safe { status: 'ok' } body", async () => {
    const res = await app.fetch(new Request("http://localhost/api/v1/health"));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok" });
  });

  test("legacy /health is preserved and unchanged", async () => {
    const res = await app.fetch(new Request("http://localhost/health"));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok" });
  });

  test("/api/v1 health carries request ID and security headers", async () => {
    const res = await app.fetch(new Request("http://localhost/api/v1/health"));
    assert.ok(res.headers.get("X-Request-ID"));
    assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
  });

  test("no invented business endpoints under /api/v1 (unknown -> uniform 404)", async () => {
    for (const p of [
      "/api/v1/transactions",
      "/api/v1/reports",
      "/api/v1/analyze",
      "/api/v1/auth",
      "/api/v1/import",
    ]) {
      const res = await app.fetch(new Request(`http://localhost${p}`, { method: "POST" }));
      assert.equal(res.status, 404, `${p} must not exist`);
      assert.deepEqual(await res.json(), {
        error: { message: "Not found", code: "NOT_FOUND" },
      });
    }
  });

  test("POST /health is not a transaction/report pipe (404, never echoes body)", async () => {
    // /health is registered as GET-only. A data-bearing POST must not be
    // accepted as a success or echo the transaction payload back.
    const res = await app.fetch(
      new Request("http://localhost/health", {
        method: "POST",
        body: JSON.stringify({ transaction: "secret-merchant" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    assert.equal(res.status, 404);
    const json = (await res.json()) as { error: { message: string; code: string } };
    const text = JSON.stringify(json).toLowerCase();
    assert.equal(text.includes("secret-merchant"), false);
    assert.deepEqual(json, {
      error: { message: "Not found", code: "NOT_FOUND" },
    });
  });
});
