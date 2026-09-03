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
