import { describe, expect, it, vi, afterEach } from "vitest";
import { ApiClient } from "./index";

describe("frontend API boundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
    return impl as typeof fetch;
  }

  it("returns not-configured without any network call when no base URL is set", async () => {
    const fetchFn = vi.fn(mockFetch(async () => new Response("{}", { status: 200 })));
    const client = new ApiClient({ baseUrl: "", fetchFn: fetchFn as unknown as typeof fetch });
    const result = await client.getHealth();
    expect(result).toEqual({ ok: false, error: "not-configured" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns the health data on a successful 2xx response", async () => {
    const fetchFn = vi.fn(
      mockFetch(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })),
    );
    const client = new ApiClient({ baseUrl: "http://localhost:3001", fetchFn: fetchFn as unknown as typeof fetch });
    const result = await client.getHealth();
    expect(fetchFn).toHaveBeenCalledWith(
      "http://localhost:3001/health",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
    expect(result).toEqual({ ok: true, data: { status: "ok" } });
  });

  it("reports an http error with the status for a non-2xx response", async () => {
    const fetchFn = vi.fn(
      mockFetch(async () => new Response("{}", { status: 503 })),
    );
    const client = new ApiClient({ baseUrl: "http://localhost:3001", fetchFn: fetchFn as unknown as typeof fetch });
    const result = await client.getHealth();
    expect(result).toEqual({ ok: false, error: "http", status: 503 });
  });

  it("reports a network failure when the request cannot be made", async () => {
    const fetchFn = vi.fn(
      mockFetch(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const client = new ApiClient({ baseUrl: "http://localhost:3001", fetchFn: fetchFn as unknown as typeof fetch });
    const result = await client.getHealth();
    expect(result).toEqual({ ok: false, error: "network" });
  });

  it("reports a timeout when the request exceeds the deadline", async () => {
    const fetchFn = vi.fn(
      mockFetch((_url, init) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }),
    );
    const client = new ApiClient({
      baseUrl: "http://localhost:3001",
      fetchFn: fetchFn as unknown as typeof fetch,
      timeoutMs: 20,
    });
    const result = await client.getHealth();
    expect(result).toEqual({ ok: false, error: "timeout" });
  });
});
