"use client";

import type { SasscoutReport } from "@/lib/report/types";
import { downloadReportCsv, downloadReportJson } from "@/lib/report/download";

export function ExportCard({ report }: { report: SasscoutReport }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-surface shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-900">Export your analysis</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Download a summary of your analysis as CSV or JSON.
        </p>
      </div>
      <div className="space-y-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => downloadReportCsv(report)}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Download CSV
          </button>
          <button
            type="button"
            onClick={() => downloadReportJson(report)}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Download JSON
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          Your report is generated locally in your browser. Your transaction data is not uploaded.
        </p>
      </div>
    </div>
  );
}
