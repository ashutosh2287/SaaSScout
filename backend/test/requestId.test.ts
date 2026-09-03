import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { app, REQUEST_ID_HEADER } from "../src/app.js";

describe("Request IDs", () => {
  test("every response carries an X-Request-ID header", async () => {
    const res = await app.fetch(new Request("http://localhost/health"));
    assert.ok(res.headers.get(REQUEST_ID_HEADER), "X-Request-ID present");
  });

  test("distinct requests receive distinct IDs", async () => {
    const a = await app.fetch(new Request("http://localhost/health"));
    const b = await app.fetch(new Request("http://localhost/health"));
    const idA = a.headers.get(REQUEST_ID_HEADER);
    const idB = b.headers.get(REQUEST_ID_HEADER);
    assert.ok(idA && idB && idA !== idB);
  });

  test("an incoming X-Request-ID is NOT trusted or echoed (fresh ID generated)", async () => {
    // A client-supplied header value is never reflected back. Passing CR/LF or
    // '=' through the browser Headers API is rejected at construction, so a
    // realistic client-controlled value (attacker/seed text) is used here; the
    // point is the app substitutes its own UUID rather than echoing it.
    const res = await app.fetch(
      new Request("http://localhost/health", {
        headers: { [REQUEST_ID_HEADER]: "client-supplied-id-123" },
      }),
    );
    const echoed = res.headers.get(REQUEST_ID_HEADER) ?? "";
    assert.notEqual(echoed, "client-supplied-id-123");
    assert.equal(echoed.includes("client-supplied-id-123"), false);
    // A randomUUID is v4 and can never contain CR/LF or attacker-chosen text —
    // so it is inherently safe as a log/header token.
    assert.match(echoed, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  test("request ID contains no transaction/user data", async () => {
    const res = await app.fetch(new Request("http://localhost/health"));
    const id = res.headers.get(REQUEST_ID_HEADER) ?? "";
    for (const needle of ["transaction", "merchant", "amount", "report", "csv"]) {
      assert.equal(id.toLowerCase().includes(needle), false);
    }
  });
});
