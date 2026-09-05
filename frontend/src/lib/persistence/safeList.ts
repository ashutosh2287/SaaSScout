// Safe shaping of stored analyses for list rendering. A single corrupted or
// tampered record must never make the whole saved list unusable: list rows are
// filtered to the minimum shape the list actually dereferences, and sorting
// tolerates missing/non-string timestamps. Corrupted records are skipped or
// shown harmlessly — never deleted, never crash the page.

export type SafeListItem = {
  id: string;
  name?: unknown;
  fileName?: unknown;
  updatedAt?: unknown;
  schemaVersion?: unknown;
};

// The saved-list view dereferences `id` (list key, detail link, delete confirm)
// and defensively reads name/fileName/updatedAt/schemaVersion. Anything that is
// not a plain object with a string `id` is unsafe to list at all.
export function isListItemSafe(value: unknown): value is SafeListItem {
  return typeof value === "object" && value !== null && typeof (value as SafeListItem).id === "string";
}

// Stable sort key: non-string timestamps sort as the earliest.
export function updatedAtStamp(value: unknown): string {
  return typeof value === "string" ? value : "0";
}

// Newest first, matching the historical list order. Never throws on junk fields.
export function sortByUpdatedAtDesc<T extends SafeListItem>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    updatedAtStamp(b.updatedAt).localeCompare(updatedAtStamp(a.updatedAt)),
  );
}