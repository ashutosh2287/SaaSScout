export type ParseCsvMeta = {
  rows: string[][];
  unterminatedQuote: boolean;
};

export function parseCsv(text: string): string[][] {
  return parseCsvWithMeta(text).rows;
}

// Same parser as parseCsv, but also reports whether the input ended while
// still inside a quoted field. An unterminated quote swallows everything up to
// EOF and silently corrupts rows, so callers surface it as a controlled error.
export function parseCsvWithMeta(text: string): ParseCsvMeta {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"' && field === "") {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }

    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }

    if (ch === "\r") {
      if (text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }

    field += ch;
    i += 1;
  }

  // final field/row if non-empty
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return { rows, unterminatedQuote: inQuotes };
}