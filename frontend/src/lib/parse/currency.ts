// Evidence-based currency detection (STEP 21).
//
// The parser used to strip currency glyphs from amounts and discard them, so a
// EUR or GBP statement was rendered as "$". This module recovers the currency
// from explicit column values, ISO codes, and unambiguous glyphs — without
// inventing a currency when the statement is silent.
//
// Honesty rules:
//   - "$" is recorded as the literal symbol, never assumed to be USD: the same
//     glyph is used by USD/CAD/AUD/MXN/etc.
//   - ¥ is dual (JPY/CNY) and is skipped.
//   - No locale-based inference. Unknown stays unknown.

export type CurrencySymbol = "$" | "€" | "£" | "₹" | "₩" | "₽";

const SYMBOL_LOOKUP: Record<string, CurrencySymbol> = {
  "$": "$",
  "€": "€",
  "£": "£",
  "₹": "₹",
  "₩": "₩",
  "₽": "₽",
};

const ISO_TO_SYMBOL: Record<string, CurrencySymbol> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  KRW: "₩",
  RUB: "₽",
};

// Currency-column cell values: ISO codes, the literal glyph, or obvious words.
const CELL_CURRENCIES: Record<string, CurrencySymbol> = {
  USD: "$",
  DOLLARS: "$",
  DOLLAR: "$",
  EUR: "€",
  EURO: "€",
  EUROS: "€",
  GBP: "£",
  POUND: "£",
  POUNDS: "£",
  INR: "₹",
  RUPEE: "₹",
  RUPEES: "₹",
  KRW: "₩",
  RUB: "₽",
  RUBLE: "₽",
  RUBLES: "₽",
};

// ISO code embedded in a free-text amount cell, e.g. "10.00 EUR" or "45 USD".
const ISO_CODE_RE = /(?:^|[\s(])(USD|EUR|GBP|INR|KRW|RUB)(?:$|[\s)])/i;

export function isCurrencySymbol(value: string | null | undefined): value is CurrencySymbol {
  return typeof value === "string" && value in SYMBOL_LOOKUP;
}

// Scan a free-text cell (amount, memo) for currency evidence.
export function detectCurrencyFromText(raw: unknown): CurrencySymbol | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (text === "") return null;

  for (const ch of text) {
    if (ch in SYMBOL_LOOKUP) return SYMBOL_LOOKUP[ch];
  }
  const code = text.match(ISO_CODE_RE);
  if (code) return ISO_TO_SYMBOL[code[1].toUpperCase()] ?? null;
  return null;
}

// Resolve a dedicated currency column cell.
export function detectCurrencyFromCell(raw: unknown): CurrencySymbol | null {
  if (typeof raw !== "string") return null;
  const upper = raw.trim().toUpperCase();
  if (upper === "") return null;
  return CELL_CURRENCIES[upper] ?? null;
}