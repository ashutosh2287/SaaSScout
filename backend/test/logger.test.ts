import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/app.js";

/** Capture console.log calls while fn runs. */
async function capture(fn: () => Promise<unknown>): Promise<string[]> {
  const original = console.log;
  const lines: string[] = [];
  console.log = (msg?: unknown, ...rest: unknown[]) => {
    lines.push([msg, ...rest].filter((x) => x !== undefined).map(String).join(" "));
  };
  try {
    await fn();
  } finally {
    console.log = original;
  }
  return lines;
}

describe("No-data logging policy", () => {
  test("logged line for /health contains ONLY safe fields (no query, headers, body, data)", async () => {
    const lines = await capture(() =>
      app.fetch(new Request("http://localhost/health?secret=shh", {
        headers: { "X-Api-Key": "super-secret", Cookie: "session=abc123" },
      })),
    );
    assert.ok(lines.length >= 1, "a request log line was emitted");
    const log = lines.find((l) => {
      try {
        const o = JSON.parse(l);
        return o && "method" in o;
      } catch {
        return false;
      }
    });
    assert.ok(log, "log contains a JSON safety line");
    const obj = JSON.parse(log);
    assert.deepEqual(Object.keys(obj).sort(), [
      "durationMs",
      "method",
      "path",
      "requestId",
      "status",
    ].sort());
    assert.equal(obj.path, "/health"); // pathname only, no query
    assert.equal(obj.method, "GET");
    assert.equal(obj.status, 200);
    // Never logs the query string, headers, cookies, or secret tokens.
    assert.equal(log.includes("secret=shh"), false);
    assert.equal(log.includes("super-secret"), false);
    assert.equal(log.includes("session=abc123"), false);
    assert.equal(log.includes("X-Api-Key"), false);
  });

  test("log never contains transaction/merchant/report vocabulary", async () => {
    const lines = await capture(() =>
      app.fetch(new Request("http://localhost/health")),
    );
    const log = lines.join(" ");
    for (const needle of ["transaction", "merchant", "amount", "report", "csv", "xlsx", "upload"]) {
      assert.equal(log.toLowerCase().includes(needle), false);
    }
  });
});
