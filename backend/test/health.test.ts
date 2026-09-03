import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/app.js";

describe("GET /health", () => {
  test("returns 200 with a deterministic { status: 'ok' } body", async () => {
    const res = await app.fetch(new Request("http://localhost/health"));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok" });
  });

  test("does not echo request headers or expose secrets/environment", async () => {
    const res = await app.fetch(
      new Request("http://localhost/health", {
        headers: { "X-Api-Key": "super-secret-token", Origin: "http://localhost:3000" },
      }),
    );
    const body = await res.json();
    assert.deepEqual(Object.keys(body), ["status"]);
    // No raw body leakage of the supplied secret value.
    assert.equal(JSON.stringify(body).includes("super-secret-token"), false);
  });

  test("never reflects transaction or user data (nothing user-supplied is sent)", async () => {
    const res = await app.fetch(new Request("http://localhost/health"));
    const text = await res.text();
    for (const needle of ["csv", "transaction", "merchant", "upload"]) {
      assert.equal(text.toLowerCase().includes(needle), false);
    }
  });
});

describe("CORS", () => {
  test("allow-listed dev origin receives an explicit Access-Control-Allow-Origin", async () => {
    const res = await app.fetch(
      new Request("http://localhost/health", {
        headers: { Origin: "http://localhost:3000" },
      }),
    );
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), "http://localhost:3000");
  });

  test("unknown origin is not echoed (no wildcard), so it cannot read the response", async () => {
    const res = await app.fetch(
      new Request("http://localhost/health", {
        headers: { Origin: "https://evil.example" },
      }),
    );
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
  });

  test("OPTIONS preflight from an allow-listed origin returns 204", async () => {
    const res = await app.fetch(
      new Request("http://localhost/health", {
        method: "OPTIONS",
        headers: { Origin: "http://127.0.0.1:3000" },
      }),
    );
    assert.equal(res.status, 204);
  });
});
