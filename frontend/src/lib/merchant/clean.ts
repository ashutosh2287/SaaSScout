import { PHONE_NUMBER_RE, REFERENCE_METADATA_RE, TRAILING_NUMBER_RE } from "./constants";

// Non-destructive cleaning: builds a conservative intermediate representation
// used by matching. The raw transaction description is never modified.
//
// Stage order:
//   trim/uppercase -> remove phone numbers -> remove ref/order ids
//   -> normalize whitespace -> remove trailing store/locator number

export function cleanDescription(raw: string): string {
  let s = raw.trim().toUpperCase();

  s = s.replace(PHONE_NUMBER_RE, " ");
  s = s.replace(REFERENCE_METADATA_RE, " ");
  s = s.replace(/\s+/g, " ").trim();

  // Remove a pure trailing numeric token (optional "#") only when a name
  // precedes it, e.g. "STARBUCKS #12345" -> "STARBUCKS". "23andMe" and
  // "7-Eleven" are unaffected (the number is not a trailing standalone word).
  if (TRAILING_NUMBER_RE.test(s)) {
    const remainder = s.replace(TRAILING_NUMBER_RE, "").trim();
    if (remainder !== "") s = remainder;
  }

  return s;
}