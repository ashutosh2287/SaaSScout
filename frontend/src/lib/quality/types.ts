export type DataQualityWarning = {
  code:
    | "MISSING_DATES"
    | "INVALID_DATES"
    | "MISSING_DESCRIPTIONS"
    | "LOW_INFORMATION_DESCRIPTIONS"
    | "ZERO_VALUE_TRANSACTIONS"
    | "EXACT_DUPLICATES"
    | "POSSIBLE_DUPLICATES"
    | "LARGE_DATE_GAP"
    | "SHORT_DATE_HISTORY"
    | "SMALL_DATASET";
  severity: "info" | "warning" | "critical";
  message: string;
  count?: number;
};

export type QualityLevel = "Good" | "Fair" | "Needs attention";
export type AnalysisReadiness = "ready" | "needs_attention" | "blocked";

export type DataQualityDiagnostics = {
  totalTransactions: number;
  validTransactions: number;
  date: {
    present: number;
    missing: number;
    invalid: number;
    earliest?: string;
    latest?: string;
  };
  description: {
    missing: number;
    lowInformation: number;
  };
  amount: {
    zero: number;
    positive: number;
    negative: number;
  };
  duplicates: {
    exact: number;
    possible: number;
  };
  coverage: {
    dateRangeDays?: number;
    monthsRepresented: number;
    transactionsByMonth: Record<string, number>;
  };
  score: number;
  level: QualityLevel;
  analysisReadiness: AnalysisReadiness;
  warnings: DataQualityWarning[];
};