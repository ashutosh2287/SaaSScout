export type AmountResult =
  | { ok: true; value: number }
  | { ok: false; reason: "empty" | "not-a-number" };

const CURRENCY = /[$£€¥₹₩₽]/g;
const GROUP_SEP = /,(?=\d{3})/g;

export function parseAmount(raw: unknown): AmountResult {
  if (raw === null || raw === undefined) return { ok: false, reason: "empty" };

  if (typeof raw === "number") {
    return Number.isFinite(raw) ? { ok: true, value: raw } : { ok: false, reason: "not-a-number" };
  }

  if (typeof raw !== "string") return { ok: false, reason: "not-a-number" };

  let s = raw.trim();
  if (s === "") return { ok: false, reason: "empty" };

  let sign = 1;

  if (s.startsWith("(") && s.endsWith(")")) {
    sign = -1;
    s = s.slice(1, -1);
  }

  const regex = /^([+-]?)\s*(.*)$/;
  const match = s.match(regex);
  if (!match) return { ok: false, reason: "not-a-number" };
  if (match[1] === "-") sign *= -1;

  s = match[2].replace(CURRENCY, "").trim();
  s = s.replace(GROUP_SEP, "");

  if (s === "") return { ok: false, reason: "not-a-number" };

  const value = Number(s);
  if (!Number.isFinite(value)) return { ok: false, reason: "not-a-number" };

  return { ok: true, value: sign * value };
}