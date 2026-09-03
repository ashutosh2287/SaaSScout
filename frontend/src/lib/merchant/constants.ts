// Conservative cleaning and matching heuristics. Precision over recall: when
// unsure whether two descriptions are the same merchant, leave them resolved
// separately rather than risk a false merge. Rules are curated, not exhaustive.

// Known payment processors. When a description begins with one of these and
// uses a "*NAME" suffix, the underlying merchant candidate is taken from after
// the star (e.g. "PAYPAL *ADOBE" -> "ADOBE"). Setting is narrow to stay safe.
export const KNOWN_PROCESSORS = ["paypal", "stripe", "square", "adyen", "worldpay"] as const;

// Generic transaction-type descriptions must not become fake merchants.
// A key made only of these words stays unresolved (canonicalName null).
export const GENERIC_RESOLUTION_WORDS = new Set([
  "payment",
  "transfer",
  "withdrawal",
  "cash",
  "deposit",
  "ach",
  "pos",
  "atm",
  "credit",
  "debit",
  "card",
  "check",
  "fee",
  "refund",
  "adjustment",
  "misc",
  "charge",
  // modifiers that, combined with a type word, still mean "no merchant"
  "online",
  "web",
  "internet",
  "electronic",
  "auto",
  "monthly",
  "purchase",
]);

// Corporate/legal suffixes stripped from the grouping key and candidate name
// when they appear as the final word. Never the only word ("LTD" alone stays).
export const CORPORATE_SUFFIXES = new Set([
  "inc",
  "inc.",
  "llc",
  "llp",
  "ltd",
  "limited",
  "corp",
  "corporation",
  "co",
  "co.",
  "plc",
]);

// Phone-number pattern removed from cleaned descriptions (not the raw txn).
// Supports "800-833-6687" and "(800) 833-6687". The raw description is untouched.
export const PHONE_NUMBER_RE = /\(?\d{3}[-.\s)]\s?\d{3}[-.\s]\d{4}\b/;

// Transaction/reference metadata removed from cleaned descriptions.
export const REFERENCE_METADATA_RE = /\b(?:ref|txn|transaction|id|order|conf(?:irmation)?)[\s#:-]*\d{3,}\b/gi;

// A pure trailing numeric token (optional "#") is a store/locator suffix.
// Only removed when it is the final standalone token, leaving a name before it
// (e.g. "STARBUCKS #12345" -> "STARBUCKS"). Embedded numbers survive.
export const TRAILING_NUMBER_RE = /\s*#?\d+\s*$/;

// Dictionary match confidence: exact alias and curated root-prefix are high.
export const DICTIONARY_CONFIDENCE = "high" as const;
export const DETERMINISTIC_CONFIDENCE = "medium" as const;
export const UNRESOLVED_CONFIDENCE = "low" as const;