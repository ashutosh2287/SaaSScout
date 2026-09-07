import { describe, expect, it } from "vitest";
import { parseFile, parseFiles } from "./index";

// Step 28 — multi-source parse. These tests focus on the merged-result
// contract and the back-compat single-file path.

function file(name: string, body: string): File {
  return new File([body], name, { type: name.endsWith(".csv") ? "text/csv" : "application/octet-stream" });
}

const CSV_A = "Date,Description,Amount\n2026-01-05,SLACK,-8.00\n2026-02-05,SLACK,-8.00\n2026-03-05,ADOBE,-59.99\n";
const CSV_B = "Date,Description,Amount\n2026-01-15,SLACK,-8.00\n2026-02-15,AWS,-50.00\n";

describe("parseFile (single-file back-compat)", () => {
  it("does not stamp `source` on transactions", async () => {
    const r = await parseFile(file("a.csv", CSV_A));
    expect(r.file.name).toBe("a.csv");
    expect(r.sources).toBeUndefined();
    for (const t of r.transactions) {
      expect(t.source).toBeUndefined();
    }
  });

  it("preserves every existing field on ParseResult", async () => {
    const r = await parseFile(file("a.csv", CSV_A));
    expect(r.parsedRows).toBe(3);
    expect(r.totalRows).toBe(3);
    expect(r.skippedRows).toBe(0);
    expect(r.transactions.length).toBe(3);
    expect(r.currency).toBeNull();
    expect(r.columnDiagnostics).toBeDefined();
  });
});

describe("parseFiles (multi-source)", () => {
  it("merges transactions and stamps `source` per file", async () => {
    const r = await parseFiles([
      { file: file("a.csv", CSV_A), label: "Account A" },
      { file: file("b.csv", CSV_B), label: "Account B" },
    ]);
    expect(r.file.name).toBe("Account A");
    expect(r.transactions.length).toBe(5); // 3 + 2
    const aTxns = r.transactions.filter((t) => t.source === "Account A");
    const bTxns = r.transactions.filter((t) => t.source === "Account B");
    expect(aTxns.length).toBe(3);
    expect(bTxns.length).toBe(2);
    // SLACK on 2026-01-15 is from B; SLACK on 2026-01-05 is from A. They are
    // the same merchant, different sources — both rows are kept, never deduped.
    expect(aTxns.find((t) => t.description === "SLACK" && t.date === "2026-01-05")).toBeDefined();
    expect(bTxns.find((t) => t.description === "SLACK" && t.date === "2026-01-15")).toBeDefined();
  });

  it("exposes a sources[] breakdown that sums to totalRows / parsedRows", async () => {
    const r = await parseFiles([
      { file: file("a.csv", CSV_A), label: "A" },
      { file: file("b.csv", CSV_B), label: "B" },
    ]);
    expect(r.sources).toBeDefined();
    expect(r.sources).toHaveLength(2);
    expect(r.sources![0]).toEqual({
      label: "A",
      transactionCount: 3,
      parsedRows: 3,
      skippedRows: 0,
    });
    expect(r.sources![1]).toEqual({
      label: "B",
      transactionCount: 2,
      parsedRows: 2,
      skippedRows: 0,
    });
    expect(r.parsedRows).toBe(r.sources!.reduce((s, x) => s + x.parsedRows, 0));
    expect(r.totalRows).toBe(r.sources!.reduce((s, x) => s + x.transactionCount, 0));
  });

  it("uses the file name as the source label when no label is given", async () => {
    const r = await parseFiles([
      { file: file("alpha.csv", CSV_A) },
      { file: file("beta.csv", CSV_B) },
    ]);
    expect(r.sources![0].label).toBe("alpha.csv");
    expect(r.sources![1].label).toBe("beta.csv");
    expect(r.file.name).toBe("alpha.csv");
  });

  it("concatenates errors and warnings across files", async () => {
    const a = "Date,Description,Amount\n2026-01-05,SLACK,-8.00\n";
    // b is empty (no rows beyond header) — the parser still records 0
    // parsed rows and the empty file surfaces in the merged result.
    const b = "Date,Description,Amount\n";
    const r = await parseFiles([
      { file: file("a.csv", a), label: "A" },
      { file: file("b.csv", b), label: "B" },
    ]);
    // a contributes 1 transaction; b contributes 0 (file is empty).
    expect(r.transactions.length).toBe(1);
    expect(r.transactions[0].source).toBe("A");
    expect(r.sources![0].parsedRows).toBe(1);
    expect(r.sources![1].parsedRows).toBe(0);
    expect(r.parsedRows).toBe(1);
  });

  it("returns currency === null when sources disagree on currency", async () => {
    const a = "Date,Description,Amount,Currency\n2026-01-05,SLACK,-8.00,USD\n";
    const b = "Date,Description,Amount,Currency\n2026-01-15,SLACK,-8.00,EUR\n";
    const r = await parseFiles([
      { file: file("a.csv", a), label: "A" },
      { file: file("b.csv", b), label: "B" },
    ]);
    expect(r.currency).toBeNull();
  });

  it("returns currency === \"$\" when every source agrees on $", async () => {
    const a = "Date,Description,Amount,Currency\n2026-01-05,SLACK,-8.00,USD\n";
    const b = "Date,Description,Amount,Currency\n2026-01-15,SLACK,-8.00,USD\n";
    const r = await parseFiles([
      { file: file("a.csv", a), label: "A" },
      { file: file("b.csv", b), label: "B" },
    ]);
    expect(r.currency).toBe("$");
  });

  it("throws when called with no files", async () => {
    await expect(parseFiles([])).rejects.toThrow();
  });

  it("does not mutate the input files", async () => {
    const fa = file("a.csv", CSV_A);
    const fb = file("b.csv", CSV_B);
    const faName = fa.name;
    const fbName = fb.name;
    await parseFiles([{ file: fa, label: "A" }, { file: fb, label: "B" }]);
    expect(fa.name).toBe(faName);
    expect(fb.name).toBe(fbName);
  });

  it("is deterministic: same inputs -> same merged transactions order", async () => {
    const r1 = await parseFiles([{ file: file("a.csv", CSV_A), label: "A" }, { file: file("b.csv", CSV_B), label: "B" }]);
    const r2 = await parseFiles([{ file: file("a.csv", CSV_A), label: "A" }, { file: file("b.csv", CSV_B), label: "B" }]);
    const sig1 = r1.transactions.map((t) => `${t.source}|${t.date}|${t.description}|${t.amount}`).join(",");
    const sig2 = r2.transactions.map((t) => `${t.source}|${t.date}|${t.description}|${t.amount}`).join(",");
    expect(sig1).toBe(sig2);
  });
});
