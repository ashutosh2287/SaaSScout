import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/app.js";
import { SECURITY_HEADERS } from "../src/headers.js";

describe("Security headers", () => {
  test("health response carries every defined security header", async () => {
    const res = await app.fetch(new Request("http://localhost/health", {
      headers: { Origin: "http://localhost:3000" },
    }));
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      assert.equal(res.headers.get(name), value, name);
    }
  });

  test("OPTIONS preflight also carries security headers (does not interfere with CORS)", async () => {
    const res = await app.fetch(
      new Request("http://localhost/health", {
        method: "OPTIONS",
        headers: { Origin: "http://127.0.0.1:3000" },
      }),
    );
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(res.headers.get("Referrer-Policy"), "no-referrer");
    // CORS still works.
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), "http://127.0.0.1:3000");
  });

  test("404 error responses carry security headers", async () => {
    const res = await app.fetch(new Request("http://localhost/does-not-exist"));
    assert.equal(res.status, 404);
    assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(res.headers.get("Cache-Control"), "no-store");
  });

  test("security headers survive an unknown (rejected) origin", async () => {
    const res = await app.fetch(
      new Request("http://localhost/health", {
        headers: { Origin: "https://evil.example" },
      }),
    );
    // CORS not granted, but security hardening still applied.
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
    assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
  });
});
