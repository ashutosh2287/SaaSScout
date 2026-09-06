import { parseFile } from "../parse";
import type { ParseResult, NormalizedTransaction } from "../parse/types";
import { inspectDataQuality } from "../quality";
import { normalizeMerchants } from "../merchant";
import { classifyMerchants } from "../classification";
import { detectRecurring } from "../recurring";
import { aggregateSoftwareSpend } from "../software";
import { detectSpendReviews } from "../leak";
import { buildReport } from "../report/build";
import type { SasscoutReport } from "../report/types";
import { parseCsv } from "../parse/csv";
import type { RawRow } from "./fixtures";

export type AnalysisSnapshot = {
  parse: ParseResult;
  quality: ReturnType<typeof inspectDataQuality>;
  merchants: ReturnType<typeof normalizeMerchants>;
  classification: ReturnType<typeof classifyMerchants>;
  recurring: ReturnType<typeof detectRecurring>;
  software: ReturnType<typeof aggregateSoftwareSpend>;
  review: ReturnType<typeof detectSpendReviews>;
  report: SasscoutReport;
};

// Full real path: file text -> parseFile (CSV parser + column detection) ->
// data quality -> merchant identity -> classification -> recurring -> software
// -> review -> report. Mirrors what the product runs in the browser.
export async function parseAndAnalyze(csv: string, fileName: string): Promise<AnalysisSnapshot> {
  const parse = await parseFile(new File([csv], fileName, { type: "text/csv" }));
  return analyzeParseResult(parse);
}

// Same pipeline from an already-parsed result (used by xlsx/paired-window tests).
export function analyzeParseResult(parse: ParseResult): AnalysisSnapshot {
  const txns = parse.transactions;
  const quality = inspectDataQuality(txns);
  const merchants = normalizeMerchants(txns);
  const classification = classifyMerchants(merchants.merchants);
  const recurring = detectRecurring(merchants.transactions);
  const software = aggregateSoftwareSpend(merchants.transactions, classification.merchants, recurring.patterns);
  const review = detectSpendReviews(software.merchants, quality, parse.currency);
  const report = buildReport(
    { parse, quality, classification, recurring, software, review },
    { generatedAt: "2026-06-30T12:00:00.000Z" },
  );
  return { parse, quality, merchants, classification, recurring, software, review, report };
}

export function txnsFromRows(rows: RawRow[]): NormalizedTransaction[] {
  return rows.map((r, i) => ({
    id: `row${i}`,
    date: r.date,
    description: r.description,
    amount: r.amount,
    sourceRow: i + 2,
  }));
}

export function classificationByKey(snapshot: AnalysisSnapshot): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of snapshot.classification.merchants) {
    if (m.normalizedKey) map.set(m.normalizedKey, m.classification.category);
  }
  return map;
}

export function parseCsvToRows(csv: string): RawRow[] {
  const rows = parseCsv(csv);
  const [header, ...body] = rows;
  const h = header.map((h) => h.toLowerCase());
  const dateIdx = h.findIndex((h) => ["date", "transaction date", "posted date"].includes(h));
  const descIdx = h.findIndex((h) => ["description", "payee", "memo", "details"].includes(h));
  const amtIdx = h.findIndex((h) => ["amount", "transaction", "amount ($)"].includes(h));
  const out: RawRow[] = [];
  for (const line of body) {
    if (line.every((c) => c.trim() === "")) continue;
    const date = dateIdx >= 0 ? line[dateIdx] : "";
    const description = descIdx >= 0 ? line[descIdx] ?? "" : "";
    const amount = amtIdx >= 0 ? Number(line[amtIdx] ?? NaN) : NaN;
    if (!Number.isFinite(amount) || amount === 0) continue;
    out.push({ date, description, amount });
  }
  return out;
}