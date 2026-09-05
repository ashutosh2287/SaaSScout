import { describe, expect, it } from "vitest";
import { isListItemSafe, sortByUpdatedAtDesc, updatedAtStamp } from "./safeList";

const validItems = [
  { id: "a", name: "A", fileName: "a.csv", updatedAt: "2026-01-02T00:00:00.000Z", schemaVersion: 1 },
  { id: "b", name: "B", fileName: "b.csv", updatedAt: "2026-01-01T00:00:00.000Z", schemaVersion: 1 },
  { id: "old", name: "Old", fileName: "o.csv", updatedAt: "2025-05-01T00:00:00.000Z", schemaVersion: 2 },
];

describe("isListItemSafe", () => {
  it("accepts full valid records", () => {
    for (const item of validItems) expect(isListItemSafe(item)).toBe(true);
  });

  it("accepts junk-shaped records that still have a string id (shown harmlessly, not crashed)", () => {
    expect(isListItemSafe({ id: "x", updatedAt: 7, name: 5, schemaVersion: "x", report: null })).toBe(true);
  });

  it("rejects null, primitives, and records without a string id", () => {
    expect(isListItemSafe(null)).toBe(false);
    expect(isListItemSafe(undefined)).toBe(false);
    expect(isListItemSafe("s")).toBe(false);
    expect(isListItemSafe(7)).toBe(false);
    expect(isListItemSafe([])).toBe(false);
    expect(isListItemSafe({})).toBe(false);
    expect(isListItemSafe({ id: 7 })).toBe(false);
    expect(isListItemSafe({ id: null })).toBe(false);
  });
});

describe("updatedAtStamp", () => {
  it("falls back to earliest for non-string timestamps", () => {
    expect(updatedAtStamp(7)).toBe("0");
    expect(updatedAtStamp(null)).toBe("0");
    expect(updatedAtStamp(undefined)).toBe("0");
    expect(updatedAtStamp("2026-01-01T00:00:00.000Z")).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("sortByUpdatedAtDesc", () => {
  it("sorts newest first and never throws", () => {
    const corrupt = { id: "corrupt-1", updatedAt: 7, name: 5, schemaVersion: "x", report: null };
    const sorted = sortByUpdatedAtDesc([corrupt, ...validItems]);
    expect(sorted.map((i) => i.id)).toEqual(["a", "b", "old", "corrupt-1"]);
  });

  it("skips nothing structural and leaves id-only junk harmlessly present", () => {
    const junk = { id: "only-id" };
    const sorted = sortByUpdatedAtDesc([junk, validItems[0]]);
    expect(sorted.map((i) => i.id)).toEqual(["a", "only-id"]);
    expect(sorted[1].id).toBe("only-id");
  });
});