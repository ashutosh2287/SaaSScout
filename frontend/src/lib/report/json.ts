import type { SasscoutReport } from "./types";

export function serializeReportJson(report: SasscoutReport): string {
  return JSON.stringify(report, null, 2);
}

export function reportFilename(report: SasscoutReport, ext: "json" | "csv"): string {
  const date = report.generatedAt.slice(0, 10);
  return `sasscout-report-${date}.${ext}`;
}
