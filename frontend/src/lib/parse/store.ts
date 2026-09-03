import type { ParseResult } from "./types";

// Module-level singleton. Survives client-side SPA navigation; cleared on full
// page load. Persistence across refresh is intentionally NOT required for V1.
let result: ParseResult | null = null;

export function setParseResult(r: ParseResult | null) {
  result = r;
}

export function getParseResult(): ParseResult | null {
  return result;
}