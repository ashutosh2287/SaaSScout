import { DEFAULT_ANALYSIS_NAME_PREFIX, SCHEMA_VERSION } from "./constants";
import type { SavedAnalysis } from "./types";
import type { SasscoutReport } from "../report/types";

export { PersistenceError, indexedDBAvailable } from "./db";
export {
  deleteAnalysis,
  getAnalysis,
  listAnalyses,
  saveAnalysis,
} from "./repository";
export type { SavedAnalysis } from "./types";

export function defaultAnalysisName(fileName: string): string {
  return `${DEFAULT_ANALYSIS_NAME_PREFIX} — ${fileName}`;
}

export function generateAnalysisId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Constructs a complete, serializable SavedAnalysis record. Pure and testable —
// does not touch IndexedDB.
export function createSavedAnalysis(
  report: SasscoutReport,
  opts?: {
    id?: string;
    now?: string;
    name?: string;
  },
): SavedAnalysis {
  const now = opts?.now ?? new Date().toISOString();
  return {
    id: opts?.id ?? generateAnalysisId(),
    createdAt: now,
    updatedAt: now,
    name: opts?.name ?? defaultAnalysisName(report.file.name),
    fileName: report.file.name,
    schemaVersion: SCHEMA_VERSION,
    report,
  };
}

export function schemaCompatible(analysis: SavedAnalysis): boolean {
  return analysis.schemaVersion === SCHEMA_VERSION;
}

// Stored report must be plain serializable data. Assert the fields we rely on
// are present and the report is an ordinary object (no File/Map/etc).
export function isSerializableAnalysis(value: unknown): value is SavedAnalysis {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.schemaVersion === "number" &&
    typeof v.createdAt === "string" &&
    typeof v.updatedAt === "string" &&
    typeof v.name === "string" &&
    typeof v.fileName === "string" &&
    typeof v.report === "object" &&
    v.report !== null
  );
}

// ---------------------------------------------------------------------------
// Read-path validation (STEP 35 hardening).
//
// Records loaded from IndexedDB are trusted input only up to the renderer: the
// store can hold data written by a buggy/older build, partially written during
// a crash, or tampered with. The read path therefore validates the whole record
// before any component dereferences it, so a corrupted record produces a
// controlled error state — never a runtime crash.
//
// The checks mirror exactly what the saved-report view and CSV/JSON exports
// dereference. Non-required fields stay optional so legitimate older records
// that still share SCHEMA_VERSION remain readable.
// ---------------------------------------------------------------------------

type JsonObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

// Deeply rejects anything JSON.stringify could choke on (bigint, functions,
// Date/Map/Set/File prototypes, NaN/Infinity — which IndexedDB's structured
// clone can store — and reference cycles). Tolerates shared references, which
// IndexedDB may legitimately preserve across a clone.
const MAX_NESTING_DEPTH = 60;

function isJsonSafeValue(
  value: unknown,
  visiting: Set<unknown>,
  done: Set<unknown>,
  depth: number,
): boolean {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    isFiniteNumber(value)
  ) {
    return true;
  }
  if (depth > MAX_NESTING_DEPTH) return false;
  if (Array.isArray(value) || isPlainObject(value)) {
    if (visiting.has(value)) return false;
    if (done.has(value)) return true;
    visiting.add(value);
    for (const key of Object.keys(value)) {
      if (!isJsonSafeValue((value as JsonObject)[key], visiting, done, depth + 1)) return false;
    }
    visiting.delete(value);
    done.add(value);
    return true;
  }
  return false;
}

function isMessageEntry(value: unknown): value is JsonObject {
  return isPlainObject(value) && typeof value.message === "string";
}

function isRecurringShape(value: unknown): boolean {
  if (value === null) return true;
  if (!isPlainObject(value)) return false;
  return (
    typeof value.status === "string" &&
    typeof value.confidence === "string" &&
    (value.interval === null || typeof value.interval === "string") &&
    Array.isArray(value.evidence) &&
    value.evidence.every(isMessageEntry) &&
    isNullableNumber(value.transactionCount) &&
    isNullableString(value.firstSeen) &&
    isNullableString(value.lastSeen) &&
    isNullableNumber(value.typicalAmount) &&
    (value.strength === null || typeof value.strength === "string") &&
    (value.amountProfile === null || typeof value.amountProfile === "string") &&
    isNullableNumber(value.intervalConsistency) &&
    isNullableNumber(value.patternSpanMonths) &&
    isNullableNumber(value.gapCount) &&
    (value.priceChange === null ||
      (isPlainObject(value.priceChange) &&
        isFiniteNumber(value.priceChange.from) &&
        isFiniteNumber(value.priceChange.to)))
  );
}

function isReportMerchantReviewShape(value: unknown): boolean {
  if (value === null) return true;
  if (!isPlainObject(value)) return false;
  return (
    typeof value.status === "string" &&
    typeof value.confidence === "string" &&
    isNullableNumber(value.score) &&
    Array.isArray(value.reasons) &&
    value.reasons.every(isMessageEntry)
  );
}

function isReportMerchantShape(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.normalizedKey === "string" &&
    typeof value.merchantName === "string" &&
    isFiniteNumber(value.transactionCount) &&
    isNullableString(value.firstSeen) &&
    isNullableString(value.lastSeen) &&
    Array.isArray(value.distinctRawDescriptions) &&
    value.distinctRawDescriptions.every((d) => typeof d === "string") &&
    isPlainObject(value.classification) &&
    typeof value.classification.category === "string" &&
    typeof value.classification.confidence === "string" &&
    Array.isArray(value.classification.evidence) &&
    value.classification.evidence.every(isMessageEntry) &&
    isRecurringShape(value.recurring) &&
    (value.softwareStatus === null || typeof value.softwareStatus === "string") &&
    isNullableNumber(value.totalSpend) &&
    isNullableNumber(value.typicalTransactionAmount) &&
    isNullableNumber(value.estimatedMonthlySpend) &&
    isNullableNumber(value.estimatedYearlySpend) &&
    isReportMerchantReviewShape(value.review)
  );
}

function isDataQualityShape(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return (
    isFiniteNumber(value.score) &&
    typeof value.level === "string" &&
    typeof value.analysisReadiness === "string" &&
    isPlainObject(value.date) &&
    isFiniteNumber(value.date.present) &&
    isFiniteNumber(value.date.missing) &&
    isPlainObject(value.description) &&
    isFiniteNumber(value.description.missing) &&
    isFiniteNumber(value.description.lowInformation) &&
    isPlainObject(value.amount) &&
    isFiniteNumber(value.amount.positive) &&
    isFiniteNumber(value.amount.negative) &&
    isFiniteNumber(value.amount.zero) &&
    isPlainObject(value.coverage) &&
    isFiniteNumber(value.coverage.monthsRepresented) &&
    Array.isArray(value.warnings) &&
    value.warnings.every(
      (w) =>
        isPlainObject(w) && typeof w.code === "string" && typeof w.severity === "string" && typeof w.message === "string",
    )
  );
}

function isValidReportShape(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const r = value;
  if (
    !isFiniteNumber(r.reportVersion) ||
    typeof r.generatedAt !== "string" ||
    !isPlainObject(r.file) ||
    typeof r.file.name !== "string" ||
    !isFiniteNumber(r.file.totalRows) ||
    !isFiniteNumber(r.file.parsedRows) ||
    !isFiniteNumber(r.file.skippedRows) ||
    !isDataQualityShape(r.quality) ||
    !isPlainObject(r.softwareSpend) ||
    !isFiniteNumber(r.softwareSpend.totalSoftwareSpend) ||
    !isFiniteNumber(r.softwareSpend.estimatedMonthlySpend) ||
    !isFiniteNumber(r.softwareSpend.estimatedYearlySpend) ||
    !isFiniteNumber(r.softwareSpend.softwareMerchantCount) ||
    !isPlainObject(r.review) ||
    !isFiniteNumber(r.review.strongReviewCount) ||
    !isFiniteNumber(r.review.reviewCount) ||
    !Array.isArray(r.merchants) ||
    !r.merchants.every(isReportMerchantShape)
  ) {
    return false;
  }
  return isJsonSafeValue(r, new Set(), new Set(), 0);
}

// Complete read-path gate: the record is structurally serializable AND its
// report matches the shape the saved-report view and exporters dereference.
export function isReadableSavedAnalysis(value: unknown): value is SavedAnalysis {
  return isSerializableAnalysis(value) && isValidReportShape(value.report);
}
