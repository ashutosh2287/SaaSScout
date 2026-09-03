export type NormalizedTransaction = {
  id: string;
  date: string | null;
  description: string;
  amount: number;
  currency?: string;
  sourceRow: number;
};

export type ColumnMap = {
  date?: string;
  description?: string;
  amount?: string;
  debit?: string;
  credit?: string;
};

export type ColumnDiagnostics = {
  detected: ColumnMap;
  missing: string[];
  ambiguous: string[];
};

export type ParseError = {
  row?: number;
  field?: string;
  code:
    | "MISSING_DATE_COLUMN"
    | "MISSING_AMOUNT_COLUMN"
    | "INVALID_DATE"
    | "INVALID_AMOUNT"
    | "INVALID_ROW"
    | "UNSUPPORTED_STRUCTURE"
    | "EMPTY_FILE";
  message: string;
};

export type ParseWarning = {
  row?: number;
  code: string;
  message: string;
};

export type ParseResult = {
  file: { name: string };
  transactions: NormalizedTransaction[];
  totalRows: number;
  parsedRows: number;
  skippedRows: number;
  errors: ParseError[];
  warnings: ParseWarning[];
  columns: ColumnMap;
  columnDiagnostics: ColumnDiagnostics;
};