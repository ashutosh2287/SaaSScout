import { describe, expect, it } from "vitest";
import { ApiClient } from "./index";
import { deriveServiceStatus } from "./health";
import type { ServiceStatus } from "./health";

describe("service status derivation", () => {
  const cases: Array<[Parameters<typeof deriveServiceStatus>[0], ServiceStatus]> = [
    [undefined, "checking"],
    [{ ok: true, data: { status: "ok" } }, "available"],
    [{ ok: false, error: "http", status: 503 }, "unavailable"],
    [{ ok: false, error: "network" }, "unavailable"],
    [{ ok: false, error: "timeout" }, "unavailable"],
    [{ ok: false, error: "not-configured" }, "not-configured"],
    // Malformed: a 200 that does not advertise a healthy status is not available.
    [{ ok: true, data: { status: "degraded" } as never }, "unavailable"],
    [{ ok: true, data: { unexpected: 1 } as never }, "unavailable"],
  ];

  it("maps each API state deterministically", () => {
    for (const [result, expected] of cases) {
      expect(deriveServiceStatus(result)).toBe(expected);
    }
  });

  it("derives available only from an explicit ok status", () => {
    expect(deriveServiceStatus({ ok: true, data: { status: "ok" } })).toBe("available");
    expect(deriveServiceStatus({ ok: true, data: { status: "bogus" } as never })).toBe(
      "unavailable",
    );
  });

  it("never leaks a transport error as a crash (all results yield a defined status)", () => {
    const all = cases.map(([r]) => deriveServiceStatus(r));
    expect(all.every((s) => ["available", "unavailable", "not-configured", "checking"].includes(s))).toBe(true);
  });
});

describe("health request boundary", () => {
  it("only calls /health and never attaches a body or transaction data", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const fetchFn = ((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedInit = init;
      return Promise.resolve(
        new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
      );
    }) as typeof fetch;
    const client = new ApiClient({ baseUrl: "http://localhost:3001", fetchFn });
    const result = await client.getHealth();
    expect(result).toEqual({ ok: true, data: { status: "ok" } });
    expect(capturedUrl).toBe("http://localhost:3001/health");
    expect(capturedInit).toBeDefined();
    // Only the Accept header; no body, no transaction/upload/report payload.
    expect(capturedInit).not.toHaveProperty("body");
    expect(capturedInit?.headers).toEqual({ Accept: "application/json" });
  });
});
