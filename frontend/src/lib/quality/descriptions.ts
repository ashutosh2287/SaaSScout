import { MIN_DESCRIPTION_LENGTH } from "./constants";

// Lowercased descriptions that frequently carry no merchant signal (e.g. from
// bank/showing generic line items). Pattern-matched, not a merchant database.
const LOW_INFO_WORDS = [
  "payment",
  "transfer",
  "withdrawal",
  "cash",
  "bank charge",
  "service charge",
  "card payment",
  "credit",
  "refund",
  "pos",
  "atm",
  "ach",
  "check",
  "deposit",
];

export function isMissingDescription(desc: string): boolean {
  return desc.trim() === "" || desc === "(no description)";
}

export function isLowInformationDescription(desc: string): boolean {
  const s = desc.trim();
  if (s === "") return false;
  if (s.length < MIN_DESCRIPTION_LENGTH) return true;
  const lower = s.toLowerCase();
  return LOW_INFO_WORDS.some((w) => lower === w || lower.startsWith(w + " "));
}