import { describe, expect, it } from "vitest";
import { summarizeParseErrors } from "./errors";
import type { ParseError } from "./types";

const err = (code: ParseError["code"], row?: number): ParseError => ({
  ...(row !== undefined ? { row } : {}),
  code,
  message: `Raw content that must never leak: "coffee" -${row ?? 0}`, 
});

describe("summarizeParseErrors", () => {
  it("returns an empty list for no errors", () => {
    expect(summarizeParseErrors([])).toEqual([]);
  });

  it("groups by code and never surfaces the raw message", () => {
    const [out] = summarizeParseErrors([err("INVALID_AMOUNT", 3), err("INVALID_AMOUNT", 40)]);
    expect(out.count).toBe(2);
    expect(out.code).toBe("INVALID_AMOUNT");
    expect(out.sampleRows).toEqual([3, 40]);
    expect(out.label).toBe("Unreadable amounts");
    expect(out.hint.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(summarizeParseErrors([err("INVALID_AMOUNT", 3)]));
    expect(serialized).not.toMatch(/coffee|Raw content/);
  });

  it("sorts by count desc, then code", () => {
    const out = summarizeParseErrors([
      err("INVALID_DATE", 1),
      err("INVALID_AMOUNT", 2),
      err("INVALID_AMOUNT", 3),
    ]);
    expect(out.map((s) => s.code)).toEqual(["INVALID_AMOUNT", "INVALID_DATE"]);
  });

  it("caps sample rows at five distinct rows", () => {
    const errors = Array.from({ length: 10 }, (_, i) => err("INVALID_DATE", i + 1));
    const [out] = summarizeParseErrors(errors);
    expect(out.count).toBe(10);
    expect(out.sampleRows).toEqual([1, 2, 3, 4, 5]);
  });

  it("handles hundreds of errors and row-less errors", () => {
    const errors = [
      ...Array.from({ length: 500 }, (_, i) => err("INVALID_AMOUNT", i + 1)),
      { ...err("EMPTY_FILE") } as ParseError,
    ];
    const out = summarizeParseErrors(errors);
    expect(out.length).toBe(2);
    expect(out.find((s) => s.code === "INVALID_AMOUNT")?.count).toBe(500);
    expect(out.find((s) => s.code === "EMPTY_FILE")?.sampleRows).toEqual([]);
  });
});