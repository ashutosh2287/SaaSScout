import type { SasscoutReport } from "../report/types";

export type SavedAnalysis = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  fileName: string;
  schemaVersion: number;
  report: SasscoutReport;
};
