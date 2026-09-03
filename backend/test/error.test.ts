import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/app.js";

describe("API error handling", () => {
  test("unknown route returns a uniform JSON 404 envelope", async () => {
    const res = await app.fetch(new Request("http://localhost/does-not-exist"));
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), {
      error: { message: "Not found", code: "NOT_FOUND" },
    });
  });

  test("404 does not leak stack traces, paths, or internals", async () => {
    const res = await app.fetch(new Request("http://localhost/does-not-exist"));
    const text = await res.text();
    assert.equal(text.includes("Error"), false);
    assert.equal(text.includes("src/"), false);
    assert.equal(text.includes("stack"), false);
  });

  test("Content-Type is JSON for error responses", async () => {
    const res = await app.fetch(new Request("http://localhost/does-not-exist"));
    assert.match(res.headers.get("content-type") ?? "", /application\/json/);
  });
});
