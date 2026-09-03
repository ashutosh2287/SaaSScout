/**
 * Service-status boundary (STEP 27).
 *
 * A single frontend → backend service-status abstraction over the typed API
 * client. Ownership:
 *
 * - `ApiClient`/`getHealth` (./index) — transport: the single network call.
 * - `deriveServiceStatus` — the only place status text/state is derived; pure
 *   and unit-tested.
 * - `useServiceStatus` — runs one bounded health check on mount.
 *
 * This is presentation data only. Nothing here touches the analysis pipeline,
 * which stays 100% local. A missing or unavailable backend never affects
 * upload, parsing, analysis, export, save, or saved reports.
 */
import { useEffect, useRef, useState } from "react";
import { getHealth, type ApiResult, type HealthResponse } from "./index";

export type ServiceStatus = "checking" | "available" | "unavailable" | "not-configured";

// A health check is only "available" when the response carries an explicit
// ok status. Anything else (HTTP error, network/timeout failure, a malformed
// body that happens to return 200, or no configured backend) resolves to a
// conservative non-available state.
export function deriveServiceStatus(
  result: ApiResult<HealthResponse> | undefined,
): ServiceStatus {
  if (!result) return "checking";
  if (!result.ok) {
    return result.error === "not-configured" ? "not-configured" : "unavailable";
  }
  return result.data?.status === "ok" ? "available" : "unavailable";
}

export function useServiceStatus(): ServiceStatus {
  const [status, setStatus] = useState<ServiceStatus>("checking");
  const disposed = useRef(false);

  useEffect(() => {
    disposed.current = false;
    let cancelled = false;
    getHealth()
      .then((result) => {
        if (!cancelled && !disposed.current) setStatus(deriveServiceStatus(result));
      })
      .catch(() => {
        // The client already maps failures to typed results; this guards any
        // unexpected throw without leaking a raw message to the UI.
        if (!cancelled && !disposed.current) setStatus("unavailable");
      });
    return () => {
      cancelled = true;
      disposed.current = true;
    };
  }, []);

  return status;
}
