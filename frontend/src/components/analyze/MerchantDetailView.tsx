"use client";

import { useMemo, useState } from "react";
import type { SasscoutReport } from "@/lib/report/types";
import { merchantDetailForKey, uniquePanelId, type MerchantDetail } from "@/lib/merchant-detail";
import { MerchantDetailPanel } from "./MerchantDetailPanel";

// Small client-side selector that derives a merchant detail from persisted
// report data only (no re-analysis) and exposes an accessible, labelled panel.
export function useMerchantDetail(report: SasscoutReport | null) {
  const [key, setKey] = useState<string | null>(null);

  const detail: MerchantDetail | null = useMemo(
    () => (key && report ? merchantDetailForKey(report, key) : null),
    [report, key],
  );

  const panel = detail ? (
    <section
      id={uniquePanelId("merchant-detail", detail.merchantKey)}
      className="rounded-lg border border-zinc-200 bg-surface px-4 py-3"
      aria-label={`${detail.merchantName} details`}
    >
      <p className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-base font-semibold text-zinc-900">{detail.merchantName}</span>
        <button
          type="button"
          onClick={() => setKey(null)}
          className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
        >
          Close details
        </button>
      </p>
      <div className="mt-2">
        <MerchantDetailPanel detail={detail} />
      </div>
    </section>
  ) : null;

  return {
    detail,
    panel,
    inspect: setKey,
    close: () => setKey(null),
  };
}