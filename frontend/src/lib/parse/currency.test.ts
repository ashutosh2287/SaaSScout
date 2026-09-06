import { describe, expect, it } from "vitest";
import { detectCurrencyFromCell, detectCurrencyFromText, isCurrencySymbol } from "./currency";
import { parseFile } from "./index";

function csv(text: string): Promise<Awaited<ReturnType<typeof parseFile>>> {
  return parseFile(new File([text], "statement.csv", { type: "text/csv" }));
}

describe("detectCurrencyFromText", () => {
  it.each([
    ["$10.50", "$"],
    ["-$10.50", "$"],
    ["a $10.50", "$"],
  ])("detects the %j literal dollar glyph", (raw, expected) => {
    expect(detectCurrencyFromText(raw)).toBe(expected);
  });

  it.each([
    ["€1.234,56", "€"],
    ["£9.99", "£"],
    ["₹1,500", "₹"],
    ["₩12,000", "₩"],
    ["₽3,000", "₽"],
  ])("detects the unambiguous glyph in %j", (raw, expected) => {
    expect(detectCurrencyFromText(raw)).toBe(expected);
  });

  it.each([
    ["10.50 EUR", "€"],
    ["45 USD total", "$"],
    ["-9.99 GBP", "£"],
    ["1,000 INR", "₹"],
    ["500 RUB", "₽"],
  ])("detects the ISO code in %j", (raw, expected) => {
    expect(detectCurrencyFromText(raw)).toBe(expected);
  });

  it("prefers the inline glyph over a trailing code", () => {
    expect(detectCurrencyFromText("€10 EUR")).toBe("€");
  });

  it("reads glyphs inside longer strings, not just at the start", () => {
    expect(detectCurrencyFromText("Total: £120.00")).toBe("£");
    expect(detectCurrencyFromText("Amount  $  25")).toBe("$");
  });

  it.each([["¥1,200"], ["1,200 JPY"], ["1,200 CNY"], ["123.45"], [""], [null], [undefined], [123], [123.45]])(
    "keeps %j unknown (ambiguous or no evidence)",
    (raw) => {
      expect(detectCurrencyFromText(raw)).toBeNull();
    },
  );
});

describe("detectCurrencyFromCell", () => {
  it.each([
    ["EUR", "€"],
    ["eur", "€"],
    ["USD", "$"],
    ["GBP", "£"],
    ["INR", "₹"],
    ["KRW", "₩"],
    ["RUB", "₽"],
    ["Dollars", "$"],
  ])("resolves the currency column value %j", (raw, expected) => {
    expect(detectCurrencyFromCell(raw)).toBe(expected);
  });

  it.each([[""], [" "], [null], [undefined], ["CHF"], ["JPY"], ["Mixed"], ["42"]])(
    "keeps the column value %j unknown",
    (raw) => {
      expect(detectCurrencyFromCell(raw)).toBeNull();
    },
  );
});

describe("isCurrencySymbol", () => {
  it("accepts only the curated symbols", () => {
    expect(isCurrencySymbol("$")).toBe(true);
    expect(isCurrencySymbol("€")).toBe(true);
    expect(isCurrencySymbol("£")).toBe(true);
    expect(isCurrencySymbol("₹")).toBe(true);
    expect(isCurrencySymbol("₩")).toBe(true);
    expect(isCurrencySymbol("₽")).toBe(true);
    expect(isCurrencySymbol("¥")).toBe(false);
    expect(isCurrencySymbol("USD")).toBe(false);
    expect(isCurrencySymbol("")).toBe(false);
    expect(isCurrencySymbol(null)).toBe(false);
    expect(isCurrencySymbol(undefined)).toBe(false);
  });
});

describe("statement currency through the full parse pipeline", () => {
  it("prefers a dedicated currency column", async () => {
    const r = await csv(
      "Date,Merchant,Amount,Currency\n2026-01-01,ACME,12.00,USD\n2026-01-02,ACME,8.00,USD\n",
    );
    expect(r.currency).toBe("$");
    expect(r.transactions.every((t) => t.currency === "$")).toBe(true);
  });

  it("falls back to the amount cells' glyphs", async () => {
    const r = await csv("Date,Merchant,Amount\n2026-01-01,CAFE,€12.00\n2026-01-02,BAR,€8.50\n");
    expect(r.currency).toBe("€");
    expect(r.transactions.every((t) => t.currency === "€")).toBe(true);
    expect(r.transactions[0].amount).toBe(12.0);
  });

  it("leaves mixed currencies honestly unknown", async () => {
    const r = await csv("Date,Merchant,Amount\n2026-01-01,CAFE,$12.00\n2026-01-02,BAR,€8.50\n");
    expect(r.currency).toBeNull();
  });

  it("leaves files with no currency evidence as null, not USD", async () => {
    const r = await csv("Date,Merchant,Amount\n2026-01-01,CAFE,12.00\n2026-01-02,BAR,8.50\n");
    expect(r.currency).toBeNull();
    expect(r.transactions.every((t) => t.currency === undefined)).toBe(true);
  });
});