export type DateResult =
  | { ok: true; value: string; ambiguous?: boolean } // value YYYY-MM-DD
  | { ok: false; reason: "empty" | "invalid" };

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function parseDate(raw: unknown): DateResult {
  if (raw === undefined || raw === null) return { ok: false, reason: "empty" };
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return { ok: false, reason: "invalid" };
    return { ok: true, value: `${raw.getFullYear()}-${pad(raw.getMonth() + 1)}-${pad(raw.getDate())}` };
  }
  if (typeof raw !== "string") return { ok: false, reason: "invalid" };

  const s = raw.trim();
  if (s === "") return { ok: false, reason: "empty" };

  // YYYY-MM-DD (also YYYY/MM/DD)
  let m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    if (valid(y, mo, d)) return { ok: true, value: `${y}-${pad(mo)}-${pad(d)}` };
    return { ok: false, reason: "invalid" };
  }

  // MM/DD/YYYY (US) or DD/MM/YYYY (ambiguous when both parts <= 12)
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
    if (!valid(y, a, b) && !valid(y, b, a)) return { ok: false, reason: "invalid" };
    if (a > 12 && b <= 12) {
      // unambiguous day/month (a=day, b=month)
      return valid(y, b, a) ? { ok: true, value: `${y}-${pad(b)}-${pad(a)}` } : { ok: false, reason: "invalid" };
    }
    if (b > 12 && a <= 12) {
      // unambiguous month/day (a=month, b=day) — US style
      return valid(y, a, b) ? { ok: true, value: `${y}-${pad(a)}-${pad(b)}` } : { ok: false, reason: "invalid" };
    }
    // both parts <= 12 -> ambiguous. Default to US month/day (common in bank
    // exports) but flag it so the caller can surface the uncertainty.
    if (valid(y, a, b)) {
      return { ok: true, value: `${y}-${pad(a)}-${pad(b)}`, ambiguous: true };
    }
    return { ok: false, reason: "invalid" };
  }

  return { ok: false, reason: "invalid" };
}

function valid(y: number, mo: number, d: number): boolean {
  if (mo < 1 || mo > 12) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}