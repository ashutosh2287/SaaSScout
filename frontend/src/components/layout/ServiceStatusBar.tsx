"use client";

import { useServiceStatus } from "@/lib/api/health";

// Presentation-only backend service indicator. Introduces exactly one health
// check (via useServiceStatus) per page mount and is mounted once in the root
// layout, so it never affects upload, parsing, analysis, or persistence. A
// unavailable or unconfigured backend only changes this strip — the local
// analysis product keeps working.
export function ServiceStatusBar() {
  const status = useServiceStatus();

  const label =
    status === "available"
      ? "Service available"
      : status === "unavailable"
        ? "Service unavailable"
        : status === "not-configured"
          ? "Backend not configured"
          : "Checking service…";

  const dot =
    status === "available"
      ? "bg-emerald-500"
      : status === "unavailable"
        ? "bg-red-500"
        : status === "not-configured"
          ? "bg-amber-500"
          : "bg-zinc-400 animate-pulse";

  const text =
    status === "available"
      ? "text-emerald-700"
      : status === "unavailable"
        ? "text-red-700"
        : status === "not-configured"
          ? "text-amber-700"
          : "text-zinc-500";

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-zinc-200 bg-white px-4 py-1.5 text-center"
    >
      <span className={`inline-flex items-center gap-2 text-xs font-medium ${text}`}>
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot}`} />
        <span>{label}</span>
      </span>
    </div>
  );
}
