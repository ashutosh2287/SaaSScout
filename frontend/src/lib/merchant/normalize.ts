import { cleanDescription } from "./clean";
import {
  CORPORATE_SUFFIXES,
  DETERMINISTIC_CONFIDENCE,
  DICTIONARY_CONFIDENCE,
  GENERIC_RESOLUTION_WORDS,
  KNOWN_PROCESSORS,
  UNRESOLVED_CONFIDENCE,
} from "./constants";
import { DICTIONARY_ROOT_WORDS, MERCHANT_DICTIONARY } from "./dictionary";
import type { MerchantConfidence, MerchantIdentity } from "./types";

// Stable grouping key: lowercase, punctuation folded to spaces, whitespace
// collapsed, legal suffix removed when final word. Deterministic across runs.
export function buildMerchantKey(cleaned: string): string {
  const key = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (key === "") return key;
  const words = key.split(" ");
  const last = words[words.length - 1];
  if (words.length > 1 && CORPORATE_SUFFIXES.has(last)) {
    words.pop();
  }
  return words.join(" ");
}

// Exact-alias lookup. O(1) via a Map from normalized alias to canonical name.
const ALIAS_INDEX: Map<string, string> = new Map();
for (const d of MERCHANT_DICTIONARY) {
  for (const alias of d.aliases) {
    ALIAS_INDEX.set(buildMerchantKey(cleanDescription(alias)), d.canonicalName);
  }
}

export function isGenericTransaction(key: string): boolean {
  if (key === "") return true;
  const words = key.split(" ");
  return words.length > 0 && words.every((w) => GENERIC_RESOLUTION_WORDS.has(w));
}

function titleCase(key: string): string {
  return key
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .replace(/ (inc|llc|ltd|corp|co|plc)$/i, "");
}

// When a description begins with a known processor and uses a "*NAME" suffix,
// the merchant candidate is the text after the last star. Narrow set keeps
// this safe; otherwise the whole cleaned text is the candidate.
function merchantCandidate(cleaned: string): string {
  const first = cleaned.split(" ")[0].toLowerCase();
  if (KNOWN_PROCESSORS.includes(first as (typeof KNOWN_PROCESSORS)[number])) {
    const star = cleaned.lastIndexOf("*");
    if (star !== -1) {
      const after = cleaned.slice(star + 1).replace(/\s+/g, " ").trim();
      if (after !== "") return after;
    }
  }
  return cleaned.replace(/\*/g, " ");
}

export function normalizeMerchant(raw: string): MerchantIdentity {
  const cleaned = cleanDescription(raw);
  const candidate = merchantCandidate(cleaned);
  const key = buildMerchantKey(candidate);

  const identity: MerchantIdentity = {
    canonicalName: null,
    normalizedKey: null,
    source: "unresolved",
    confidence: UNRESOLVED_CONFIDENCE,
    rawDescription: raw,
    cleanedDescription: cleaned,
  };

  // All resolved paths agree on source/confidence; only name and key differ.
  const resolve = (canonicalName: string, normalizedKey: string, source: "dictionary" | "deterministic", confidence: MerchantConfidence) => {
    identity.canonicalName = canonicalName;
    identity.normalizedKey = normalizedKey;
    identity.source = source;
    identity.confidence = confidence;
    return identity;
  };

  if (raw.trim() === "" || raw === "(no description)" || key === "") {
    return identity;
  }
  if (isGenericTransaction(key)) {
    return identity;
  }

  // 1. Exact alias match
  const exact = ALIAS_INDEX.get(key);
  if (exact) {
    return resolve(exact, buildMerchantKey(cleanDescription(exact)), "dictionary", DICTIONARY_CONFIDENCE);
  }

  // 2. Curated root-prefix match (first word is a known merchant root)
  const root = key.split(" ")[0];
  const byRoot = DICTIONARY_ROOT_WORDS[root];
  if (byRoot) {
    return resolve(byRoot, root, "dictionary", DICTIONARY_CONFIDENCE);
  }

  // 3. Safe deterministic candidate (no auto-merge; exact key grouping only)
  return resolve(titleCase(key), key, "deterministic", DETERMINISTIC_CONFIDENCE);
}