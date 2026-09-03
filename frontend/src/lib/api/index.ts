/**
 * Frontend → backend API boundary.
 *
 * A single typed client that isolates all backend communication. STEP 26 only
 * wires the health endpoint used to verify connectivity. It never sends
 * transaction, merchant, upload, analysis, or financial data — the analysis
 * pipeline stays local-first. When the backend is unavailable or not
 * configured, the client reports a typed failure and the app keeps working.
 *
 * The client is dependency-injectable (baseUrl, fetch, timeout) so it can be
 * unit-tested in Node without a browser or a running server, and so future
 * backends can be reached without changing call sites.
 */

export const DEFAULT_API_BASE_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : ""
  ).replace(/\/+$/, "");

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: "not-configured" | "network" | "timeout" | "http"; status?: number };

export type HealthResponse = { status: "ok" };

type ApiClientDeps = {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
};

class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly externalSignal?: AbortSignal;

  constructor(deps: ApiClientDeps = {}) {
    this.baseUrl = deps.baseUrl ?? DEFAULT_API_BASE_URL;
    this.fetchFn =
      deps.fetchFn ?? (typeof fetch !== "undefined" ? fetch.bind(globalThis) : undefined) as typeof fetch;
    this.timeoutMs = deps.timeoutMs ?? 5000;
    this.externalSignal = deps.signal;
  }

  private async request<T>(path: string): Promise<ApiResult<T>> {
    if (!this.baseUrl) {
      // No backend configured: never make a network call, never fail the app.
      return { ok: false, error: "not-configured" };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const onAbort = () => controller.abort();
    this.externalSignal?.addEventListener("abort", onAbort);

    try {
      const res = await this.fetchFn(`${this.baseUrl}${path}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!res.ok) {
        return { ok: false, error: "http", status: res.status };
      }
      const data = (await res.json()) as T;
      return { ok: true, data };
    } catch {
      if (controller.signal.aborted) {
        return { ok: false, error: "timeout" };
      }
      // Never log sensitive data; only the failure category is described.
      return { ok: false, error: "network" };
    } finally {
      clearTimeout(timer);
      this.externalSignal?.removeEventListener("abort", onAbort);
    }
  }

  getHealth(): Promise<ApiResult<HealthResponse>> {
    return this.request<HealthResponse>("/health");
  }
}

// Default singleton uses the configured NEXT_PUBLIC_API_URL and global fetch.
const defaultClient = new ApiClient();

export function getHealth(): Promise<ApiResult<HealthResponse>> {
  return defaultClient.getHealth();
}

// Exported for tests and for future customizing of base URL/transport.
export { ApiClient };
