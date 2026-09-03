"use client";

import type { SavedAnalysis } from "@/lib/persistence/types";
import { Container } from "@/components/ui/Container";
import { DashboardMetrics } from "./DashboardMetrics";
import { ReviewQueue } from "./ReviewQueue";
import { SoftwareBreakdown } from "./SoftwareBreakdown";
import { DataQualityCard } from "./DataQualityCard";
import { RecurringCard } from "./RecurringCard";
import { ExportCard } from "./ExportCard";
import { useMerchantDetail } from "./MerchantDetailView";
import { savedRecurringCounts } from "@/lib/report/view";
import type { RecurringSummary } from "@/lib/recurring/types";
import { deriveDashboard, rowFromReportMerchant } from "@/lib/dashboard";

// Report-driven view. No analysis is re-run; the view is built entirely from
// the saved report so it stays consistent with the live dashboard.
export function SavedReportView({ saved }: { saved: SavedAnalysis }) {
  const report = saved.report;
  const merchantDetail = useMerchantDetail(report);
  const view = deriveDashboard({
    rows: report.merchants.map(rowFromReportMerchant),
    softwareSpend: report.softwareSpend,
    review: report.review,
    qualityReadiness: report.quality.analysisReadiness,
  });
  const blocked = report.quality.analysisReadiness === "blocked";
  const c = savedRecurringCounts(report.merchants);
  const recurringSummary: RecurringSummary = {
    likelyRecurringCount: c.likelyRecurring,
    possiblyRecurringCount: c.possiblyRecurring,
    notRecurringCount: c.notRecurring,
    insufficientDataCount: c.insufficientData,
    totalAnalyzed: c.totalAnalyzed,
  };

  return (
    <Container>
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
          {saved.name}
        </h1>
        <p className="mt-3 text-zinc-600">
          <span className="font-medium text-zinc-900">{report.file.name}</span> — saved analysis.
          Opened from this device, no re-analysis performed.
        </p>
      </div>

      <div className="mt-8">
        <DashboardMetrics metrics={view.metrics} />
      </div>

      <div className="mt-4">
        <ReviewQueue
          reviews={view.reviewQueue}
          blocked={blocked}
          strongReviewCount={report.review.strongReviewCount}
          reviewCount={report.review.reviewCount}
          onInspect={merchantDetail.inspect}
        />
      </div>

      {merchantDetail.panel && <div className="mt-4">{merchantDetail.panel}</div>}

      <div className="mt-4">
        <RecurringCard s={recurringSummary} />
      </div>

      <SoftwareBreakdown rows={view.softwareRows} onInspect={merchantDetail.inspect} />

      <div className="mt-4">
        <DataQualityCard q={report.quality} />
      </div>

      <div className="mt-4">
        <ExportCard report={report} />
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        Saved privately on this device on {formatDate(saved.updatedAt)}. No transaction data has
        been uploaded or placed in the URL.
      </p>
    </Container>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
