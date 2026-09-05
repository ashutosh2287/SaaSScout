/**
 * STEP 34 — parse-layer analytical correctness, edge cases & data-integrity.
 *
 * Synthetic fixtures only. Regression tests for the four confirmed bugs:
 *   BUG A  XLSX date cells were String()ed into locale strings and rejected
 *          (fixed: date cells become YYYY-MM-DD via parseDate).
 *   BUG B  Unterminated quoted CSV fields silently corrupted rows (fixed:
 *          parseCsvWithMeta reports unterminatedQuote; parseFile surfaces a
 *          controlled UNSUPPORTED_STRUCTURE error).
 *   BUG C  Extreme-but-finite amounts could overflow report sums to Infinity
 *          (fixed: parseAmount rejects |value| > Number.MAX_SAFE_INTEGER).
 *   BUG D  debit/credit 0/0 produced INVALID_AMOUNT while a unified amount of
 *          "0" produced a zero transaction (fixed: numeric zero on either side
 *          yields a zero transaction).
 *
 * Plus a broad set of valid/malformed/boundary fixtures proving the documented
 * semantics (US-first ambiguous dates, missing date column -> null date,
 * first-meaningful-row XLSX header detection, duplicate header last-column-wins).
 */
import { beforeEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseFile } from "./index";
import { parseAmount } from "./amounts";
import { parseDate } from "./dates";
import { parseCsvWithMeta } from "./csv";
import { readWorksheet } from "./xlsx";
import { detectColumns } from "./columns";
import { buildHeaderIndex, normalizeRow, resetIdCounter } from "./normalize";
import type { ParseResult } from "./types";

function csvFile(content: string, name = "txns.csv"): File {
  return new File([content], name, { type: "text/csv" });
}

function xlsxFile(buffer: ArrayBuffer, name = "txns.xlsx"): File {
  return new File([buffer], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function workbookBuffer(aoaList: unknown[][][], sheetNames?: string[]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  aoaList.forEach((aoa, i) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa as unknown[][]);
    XLSX.utils.book_append_sheet(wb, ws, sheetNames?.[i] ?? `Sheet${i + 1}`);
  });
  return XLSX.write(wb, { type: "array", bookType: "xlsx", cellDates: true }) as ArrayBuffer;
}

beforeEach(() => resetIdCounter());

// ────────────────────────────────────────────────────────────────────────────
// BUG A — XLSX date cells parse correctly (were INVALID_DATE)
// ────────────────────────────────────────────────────────────────────────────
describe("STEP 34 — BUG A: XLSX date cells", () => {
  const buffer = workbookBuffer([
    [["Date", "Description", "Amount"], [new Date(2024, 2, 15), "NETFLIX", 9.99], [new Date(2024, 3, 1), "SPOTIFY", -12.5]],
  ]);

  it("converts real date cells to YYYY-MM-DD instead of locale strings", async () => {
    const ws = await readWorksheet(buffer);
    expect(ws.rows[0][0]).toBe("2024-03-15");
    expect(ws.rows[1][0]).toBe("2024-04-01");
  });

  it("parses a full XLSX file with date + numeric amount cells", async () => {
    const result = await parseFile(xlsxFile(buffer));
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]).toMatchObject({ date: "2024-03-15", description: "NETFLIX", amount: 9.99 });
    expect(result.transactions[1]).toMatchObject({ date: "2024-04-01", description: "SPOTIFY", amount: -12.5 });
    expect(result.errors).toEqual([]);
  });

  it("reads only the first sheet", async () => {
    const multi = workbookBuffer(
      [
        [["Date", "Description", "Amount"], [new Date(2024, 2, 15), "NETFLIX", 9.99]],
        [["Date", "Description", "Amount"], [new Date(2024, 1, 1), "SHOPIFY", 29.0]],
      ],
      ["First", "Second"],
    );
    const result = await parseFile(xlsxFile(multi));
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toBe("NETFLIX");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// BUG B — Unterminated quoted CSV field surfaces a controlled error
// ────────────────────────────────────────────────────────────────────────────
describe("STEP 34 — BUG B: unterminated CSV quotes", () => {
  it("reports an unterminated quote swallowing the rest of the file", () => {
    const { rows, unterminatedQuote } = parseCsvWithMeta('Date,Description,Amount\n"2026-01-01","ACME","10.00');
    expect(unterminatedQuote).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("reports a clean file as not unterminated", () => {
    expect(parseCsvWithMeta('Date,Description,Amount\n2026-01-01,"Acme, Inc","10.00"\n').unterminatedQuote).toBe(false);
  });

  it("parseFile surfaces UNSUPPORTED_STRUCTURE instead of silently corrupting rows", async () => {
    const result = await parseFile(csvFile('Date,Description,Amount\n"2026-01-01","ACME, CORP","10.00'));
    expect(result.transactions).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("UNSUPPORTED_STRUCTURE");
  });

  it("still scores a well-formed final quoted row", async () => {
    const result = await parseFile(csvFile('Date,Description,Amount\n2026-01-01,"ACME, CORP","10.00"'));
    expect(result.transactions).toHaveLength(1);
    expect(result.errors).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// BUG C — Extreme amounts rejected; money stays finite and precise
// ────────────────────────────────────────────────────────────────────────────
describe("STEP 34 — BUG C: extreme amount guard", () => {
  it("rejects magnitudes beyond Number.MAX_SAFE_INTEGER", () => {
    expect(parseAmount("1e308")).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseAmount("-1e308")).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseAmount("9007199254740992")).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseAmount(1e308)).toEqual({ ok: false, reason: "not-a-number" });
  });

  it("accepts exactly Number.MAX_SAFE_INTEGER", () => {
    expect(parseAmount(String(Number.MAX_SAFE_INTEGER))).toEqual({ ok: true, value: Number.MAX_SAFE_INTEGER });
  });

  it("still rejects NaN and Infinity", () => {
    expect(parseAmount(NaN)).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseAmount(Infinity)).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseAmount(-Infinity)).toEqual({ ok: false, reason: "not-a-number" });
  });

  it("parses real-world magnitudes and signed zero", () => {
    expect(parseAmount("999999999999.99")).toEqual({ ok: true, value: 999999999999.99 });
    const zero = parseAmount("-0.00");
    expect(zero.ok).toBe(true);
    if (zero.ok) expect(Math.abs(zero.value)).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// BUG D — debit/credit zero rows behave like a zero unified amount
// ────────────────────────────────────────────────────────────────────────────
describe("STEP 34 — BUG D: debit/credit zero consistency", () => {
  const DEBIT_CREDIT = ["Date", "Description", "Debit", "Credit"];

  function row(values: string[], sourceRow = 1) {
    const cols = detectColumns(DEBIT_CREDIT);
    const idx = buildHeaderIndex(cols.detected, DEBIT_CREDIT);
    return normalizeRow(values, cols.detected, idx, sourceRow);
  }

  it("turns 0/0 into a zero transaction", () => {
    const r = row(["2026-01-01", "ACME", "0", "0"]);
    expect(r.kind).toBe("transaction");
    if (r.kind === "transaction") expect(r.txn.amount).toBe(0);
  });

  it("turns a lone numeric zero into a zero transaction", () => {
    expect(row(["2026-01-01", "ACME", "0", ""]).kind).toBe("transaction");
    expect(row(["2026-01-01", "ACME", "", "0"]).kind).toBe("transaction");
    expect(row(["2026-01-01", "ACME", "0.00", ""]).kind).toBe("transaction");
  });

  it("preserves sign semantics on real amounts", () => {
    const d = row(["2026-01-01", "ACME", "5.00", ""]);
    const c = row(["2026-01-01", "ACME", "", "7.00"]);
    expect(d).toMatchObject({ kind: "transaction" });
    expect(c).toMatchObject({ kind: "transaction" });
    if (d.kind === "transaction") expect(d.txn.amount).toBe(-5);
    if (c.kind === "transaction") expect(c.txn.amount).toBe(7);
  });

  it("still errors on garbage beside a zero", () => {
    expect(row(["2026-01-01", "ACME", "abc", "0"]).kind).toBe("error");
    expect(row(["2026-01-01", "ACME", "0", "abc"]).kind).toBe("error");
  });

  it("still errors when both sides are blank/empty", () => {
    expect(row(["2026-01-01", "ACME", "", ""]).kind).toBe("error");
  });

  it("still errors when both sides are non-zero", () => {
    const r = row(["2026-01-01", "ACME", "1", "2"]);
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.error.code).toBe("INVALID_AMOUNT");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// CSV valid fixtures — documented shapes all parse predictably
// ────────────────────────────────────────────────────────────────────────────
describe("STEP 34 — CSV valid fixtures", () => {
  const cases: Array<{ name: string; csv: string; rows: number; asserts?: (r: ParseResult) => void }> = [
    { name: "plain", csv: "Date,Description,Amount\n2026-01-01,ACME,10.00", rows: 1 },
    { name: "BOM + CRLF", csv: "\uFEFFDate,Description,Amount\r\n2026-01-02,ACME,-5.00\r\n", rows: 1 },
    { name: "quoted commas", csv: 'Date,Description,Amount\n"2026-01-03","Acme, Inc",12.50', rows: 1 },
    { name: "escaped quotes", csv: 'Date,Description,Amount\n2026-01-04,"He said ""hi""",3.00', rows: 1 },
    { name: "reordered columns", csv: "Amount,Date,Description\n99.00,2026-01-05,RENAMED", rows: 1 },
    { name: "extra columns", csv: "Date,Description,Amount,Notes\n2026-01-06,EXTRA,7.00,ignore me", rows: 1 },
    { name: "missing description column", csv: "Date,Amount\n2026-01-07,4.00", rows: 1 },
    { name: "unicode description", csv: "Date,Description,Amount\n2026-01-08,カフェ 東京,-10.00", rows: 1 },
    { name: "padded amount", csv: "Date,Description,Amount\n2026-01-09,ACME,  11.50  ", rows: 1 },
    { name: "currency + thousands", csv: 'Date,Description,Amount\n2026-01-10,ACME,"$1,234.56"', rows: 1 },
    { name: "debit/credit debit side", csv: "Date,Description,Debit,Credit\n2026-01-11,ACME,5.00,", rows: 1 },
    { name: "debit/credit credit side", csv: "Date,Description,Debit,Credit\n2026-01-12,ACME,,7.00", rows: 1 },
    { name: "debit/credit numeric zero", csv: "Date,Description,Debit,Credit\n2026-01-13,ACME,0,0", rows: 1 },
    { name: "withdrawal/deposit synonyms", csv: "Date,Name,Withdrawal,Deposit\n2026-01-16,ACME,25.00,", rows: 1 },
    { name: "transaction date/merchant name/total", csv: "Transaction Date,Merchant Name,Total\n2026-01-17,ACME CORP,42.50", rows: 1 },
    { name: "dd/mm unambiguous", csv: "Date,Description,Amount\n31/01/2026,ACME,9.00", rows: 1 },
    { name: "yyyy/mm slash", csv: "Date,Description,Amount\n2026/01/31,ACME,9.00", rows: 1 },
    { name: "zero amount", csv: "Date,Description,Amount\n2026-01-19,ACME,0.00", rows: 1 },
    { name: "blank rows skipped", csv: "Date,Description,Amount\n2026-01-18,ACME,3.00\n\n2026-01-20,ACME,4.00", rows: 2 },
    { name: "total row skipped", csv: "Date,Description,Amount\n2026-01-14,ACME,2.00\nTotal,,15.00", rows: 1 },
    { name: "header only", csv: "Date,Description,Amount\n", rows: 0 },
    { name: "duplicate description header last-wins", csv: "Date,Description,Amount,Extra,Description\n2026-01-01,IGNORED,10.00,notes,REAL DESC", rows: 1 },
    { name: "empty header cell", csv: "Date,Description,,Amount\n2026-01-01,ACME,notes,8.00", rows: 1 },
  ];

  for (const c of cases) {
    it(c.name, async () => {
      const result = await parseFile(csvFile(c.csv));
      expect(result.transactions).toHaveLength(c.rows);
      expect(result.errors).toEqual([]);
      c.asserts?.(result);
    });
  }

  it("applies sign semantics to both debit/credit fixture sides", async () => {
    const d = await parseFile(csvFile("Date,Description,Debit,Credit\n2026-01-11,ACME,5.00,"));
    expect(d.transactions[0].amount).toBe(-5);
    const c = await parseFile(csvFile("Date,Description,Debit,Credit\n2026-01-12,ACME,,7.00"));
    expect(c.transactions[0].amount).toBe(7);
  });

  it("keeps dates that are ambiguous flagged as warnings, not errors", async () => {
    const result = await parseFile(csvFile("Date,Description,Amount\n01/02/2026,ACME,5.00"));
    expect(result.transactions[0].date).toBe("2026-01-02");
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => w.code === "AMBIGUOUS_DATE")).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// CSV malformed fixtures — controlled errors, never silent corruption
// ────────────────────────────────────────────────────────────────────────────
describe("STEP 34 — CSV malformed fixtures", () => {
  it("empty file -> EMPTY_FILE", async () => {
    const result = await parseFile(csvFile(""));
    expect(result.transactions).toEqual([]);
    expect(result.errors.map((e) => e.code)).toEqual(["EMPTY_FILE"]);
  });

  it("whitespace-only file -> no usable header", async () => {
    const result = await parseFile(csvFile("\n\n"));
    expect(result.transactions).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("MISSING_AMOUNT_COLUMN");
  });

  it("short row (missing amount cell) -> controlled INVALID_AMOUNT", async () => {
    const result = await parseFile(csvFile("Date,Description,Amount\n2026-01-01,ACME"));
    expect(result.transactions).toEqual([]);
    expect(result.errors[0].code).toBe("INVALID_AMOUNT");
    expect(result.errors[0].row).toBe(1);
  });

  it("binary bytes named .csv produce only controlled parse errors", async () => {
    const result = await parseFile(csvFile("PK\x03\x04\x00\x00\n\x00\x00\x01\x00\x00"));
    expect(result.transactions).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
    for (const e of result.errors) {
      expect(["INVALID_AMOUNT", "INVALID_DATE", "INVALID_ROW", "UNSUPPORTED_STRUCTURE"]).toContain(e.code);
    }
  });

  it("garbage header produces per-row errors, not a crash", async () => {
    const result = await parseFile(csvFile("not,a,header\n2026,1,2"));
    expect(result.transactions).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// XLSX structural fixtures
// ────────────────────────────────────────────────────────────────────────────
describe("STEP 34 — XLSX structural fixtures", () => {
  it("finds the header as the first meaningful row (blank rows before it)", async () => {
    const buffer = workbookBuffer([
      [[], [], ["Date", "Description", "Amount"], [new Date(2026, 0, 5), "ACME", 5.0]],
    ]);
    const result = await parseFile(xlsxFile(buffer));
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toBe("ACME");
    expect(result.errors).toEqual([]);
  });

  it("numeric negative amount cells parse", async () => {
    const buffer = workbookBuffer([
      [["Date", "Description", "Amount"], [new Date(2026, 0, 5), "ACME", -10] as unknown[]],
    ]);
    const result = await parseFile(xlsxFile(buffer));
    expect(result.transactions[0].amount).toBe(-10);
  });

  it("headers-only workbook -> zero rows, no errors", async () => {
    const buffer = workbookBuffer([[["Date", "Description", "Amount"]]]);
    const result = await parseFile(xlsxFile(buffer));
    expect(result.transactions).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("blank worksheet -> controlled EMPTY_FILE error", async () => {
    const buffer = workbookBuffer([[]]);
    await expect(readWorksheet(buffer)).rejects.toThrow("EMPTY_FILE");
  });

  it("corrupt bytes never present a clean silent result", async () => {
    const buffer = workbookBuffer([[["Date", "Description", "Amount"]]]);
    const bytes = new Uint8Array(buffer.slice(0));
    bytes[0] = 0x58; // corrupt the ZIP ("PK") signature
    bytes[1] = 0x58;
    // SheetJS is tolerant and reads the stream into garbage cells; the parse
    // layer must surface controlled errors instead of a plausible empty result.
    const result = await parseFile(xlsxFile(bytes.buffer.slice(0)));
    expect(result.errors.length).toBeGreaterThan(0);
    for (const e of result.errors) {
      expect(["INVALID_AMOUNT", "INVALID_DATE", "INVALID_ROW", "UNSUPPORTED_STRUCTURE"]).toContain(e.code);
    }
  });

  it("title row before header -> current semantics: first meaningful row is header", async () => {
    const buffer = workbookBuffer([
      [["My Bank Export"], ["Date", "Description", "Amount"], [new Date(2026, 0, 5), "ACME", 5.0]],
    ]);
    const result = await parseFile(xlsxFile(buffer));
    expect(result.transactions).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Date boundaries (parseDate unit)
// ────────────────────────────────────────────────────────────────────────────
describe("STEP 34 — date boundary semantics", () => {
  it("accepts leap day in a leap year, rejects it otherwise", () => {
    expect(parseDate("2024/02/29")).toEqual({ ok: true, value: "2024-02-29" });
    expect(parseDate("2023-02-29")).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects impossible calendar dates", () => {
    expect(parseDate("2026-04-31")).toEqual({ ok: false, reason: "invalid" });
    expect(parseDate("2026-13-01")).toEqual({ ok: false, reason: "invalid" });
  });

  it("treats unambiguous european order correctly", () => {
    expect(parseDate("13/01/2026")).toEqual({ ok: true, value: "2026-01-13" });
    expect(parseDate("01/31/2026")).toEqual({ ok: true, value: "2026-01-31" });
  });

  it("flags ambiguous MM/DD as US-first with AMBIGUOUS_DATE", () => {
    const r = parseDate("01/02/2026");
    expect(r).toEqual({ ok: true, value: "2026-01-02", ambiguous: true });
  });

  it("formats Date instances using local calendar components", () => {
    expect(parseDate(new Date(2026, 0, 15))).toEqual({ ok: true, value: "2026-01-15" });
    expect(parseDate(new Date(2024, 1, 29))).toEqual({ ok: true, value: "2024-02-29" });
    expect(parseDate(new Date(NaN))).toEqual({ ok: false, reason: "invalid" });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// normalizeRow structural behaviors
// ────────────────────────────────────────────────────────────────────────────
describe("STEP 34 — normalizeRow structural behaviors", () => {
  const COMMON = ["Date", "Description", "Amount"];

  function row(values: string[], sourceRow = 1) {
    const cols = detectColumns(COMMON);
    const idx = buildHeaderIndex(cols.detected, COMMON);
    return normalizeRow(values, cols.detected, idx, sourceRow);
  }

  it("missing date column yields a null date transaction without error", async () => {
    const result = await parseFile(csvFile("Description,Amount\nACME,10.00"));
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].date).toBeNull();
    expect(result.errors).toEqual([]);
  });

  it("blank rows and total rows are skipped, not errors", () => {
    expect(row(["", "", ""]).kind).toBe("skipped");
    const total = row(["Total", "", "150.00"]);
    expect(total.kind).toBe("skipped");
    if (total.kind === "skipped") expect(total.reason).toBe("total");
  });

  it("missing description becomes the placeholder string", () => {
    const r = row(["2026-01-01", "", "10.00"]);
    expect(r.kind).toBe("transaction");
    if (r.kind === "transaction") expect(r.txn.description).toBe("(no description)");
  });

  it("assigns sequential ids across rows", () => {
    const a = row(["2026-01-01", "ACME", "1"], 1);
    const b = row(["2026-01-02", "ACME", "2"], 2);
    if (a.kind === "transaction" && b.kind === "transaction") {
      expect(a.txn.id).toBe("t1");
      expect(b.txn.id).toBe("t2");
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// STEP 36 — XLSX zip-bomb (compressed-expansion) guard
// ────────────────────────────────────────────────────────────────────────────
import { deflateRawSync } from "node:zlib";

function zipBuffer(entries: { name: string; data: Uint8Array; compress: boolean }[]): ArrayBuffer {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const data = e.compress ? deflateRawSync(Buffer.from(e.data)) : e.data;
    const local = new Uint8Array(30 + name.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, e.compress ? 0x0800 : 0, true);
    lv.setUint16(10, e.compress ? 8 : 0, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, e.data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    locals.push(local);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, e.compress ? 0x0800 : 0, true);
    cv.setUint16(10, e.compress ? 8 : 0, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, e.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length;
  }
  const cd = new Uint8Array(centrals.reduce((s, c) => s + c.length, 0));
  let o = 0;
  for (const c of centrals) {
    cd.set(c, o);
    o += c.length;
  }
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cd.length, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + cd.length + 22);
  let p = 0;
  for (const l of locals) {
    out.set(l, p);
    p += l.length;
  }
  out.set(cd, p);
  out.set(eocd, p + cd.length);
  return out.buffer as ArrayBuffer;
}

describe("STEP 36 — XLSX compressed-expansion guard", () => {
  it("accepts a normal workbook and parses it", async () => {
    const result = await parseFile(xlsxFile(workbookBuffer([
      [["Date", "Description", "Amount"], ["2026-01-01", "ACME", "10.00"]],
    ])));
    expect(result.transactions).toHaveLength(1);
    expect(result.errors).toEqual([]);
  });

  it("rejects a tiny zip whose content would inflate to 256MB+ before inflating it", async () => {
    // Hand-built zip that advertises a huge uncompressed sharedStrings entry in
    // its central directory — exactly what a zip bomb looks like.
    const fake = zipBuffer([
      { name: "[Content_Types].xml", data: new TextEncoder().encode("<Types/>"), compress: true },
      { name: "xl/sharedStrings.xml", data: new Uint8Array(300 * 1024 * 1024), compress: true },
    ]);
    expect(fake.byteLength).toBeLessThan(1024 * 1024); // tiny on disk
    await expect(parseFile(xlsxFile(fake))).rejects.toThrow("XLSX_TOO_LARGE");
  });

  it("rejects a corrupt/non-zip file with a controlled error", async () => {
    const notZip = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
    await expect(parseFile(xlsxFile(notZip))).rejects.toThrow("COULD_NOT_READ_XLSX");
  });

  it("sums uncompressed sizes across many entries instead of per-entry only", async () => {
    const entries = [];
    for (let i = 0; i < 200; i++) {
      entries.push({
        name: `xl/parts/part${i}.xml`,
        data: new Uint8Array(2 * 1024 * 1024), // 200 × 2MB = 400MB total > cap
        compress: true,
      });
    }
    await expect(parseFile(xlsxFile(zipBuffer(entries)))).rejects.toThrow("XLSX_TOO_LARGE");
  });
});