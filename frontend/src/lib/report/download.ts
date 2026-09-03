import { reportFilename, serializeReportJson } from "./json";
import { serializeReportCsv } from "./csv";
import type { SasscoutReport } from "./types";

function download(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadReportJson(report: SasscoutReport): void {
  download(serializeReportJson(report), reportFilename(report, "json"), "application/json");
}

export function downloadReportCsv(report: SasscoutReport): void {
  download(serializeReportCsv(report), reportFilename(report, "csv"), "text/csv;charset=utf-8");
}
