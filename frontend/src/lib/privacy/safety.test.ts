import { describe, expect, it } from "vitest";
import { privacy } from "./content";

// STEP 28 privacy-copy regression guard.
//
// Fails if /privacy copy makes privacy/security claims the implementation
// does not support, or introduces trust language that violates STEP 22 rules.
// This mirrors the shared trust-language scanner but is scoped to the privacy
// content model (src/lib/privacy contains no analysis UI and is not covered by
// src/lib/trust-language.test.ts, which scans components/{analyze,landing}).

function allText(): string {
  const parts: string[] = [];
  function push(v: unknown) {
    if (typeof v === "string") {
      parts.push(v);
    } else if (Array.isArray(v)) {
      v.forEach((x) => push(x));
    } else if (v && typeof v === "object") {
      for (const k of Object.keys(v as Record<string, unknown>)) {
        push((v as Record<string, unknown>)[k]);
      }
    }
  }
  push(privacy);
  return parts.join(" ").toLowerCase();
}

const text = allText();

// Forbidden non-negated claims / trust language (STEP 22 + STEP 28 rules).
const FORBIDDEN =
  /\b100% ?private\b|\bcompletely ?private\b|\bguaranteed? ?private\b|\bnever ?seen\b|\bzero ?data\b|\bsecure ?by ?design\b|\bbank-?grade\b|\bmilitary-?grade\b|\bencrypt(ed|ion)?\b|\bgdpr\b|\bccpa\b|\bsocl?\b|\bisoa?\b|\bcert(ified|ification|ification)?\b|\bai ?privacy\b|\bcloud ?backup\b|\bsavings\b|\bwasted?\b|\bguarantee[ds]?\b|\bdefinitely\b|\bunused\b/;

describe("/privacy copy safety", () => {
  it("contains no unsupported privacy/security claims or forbidden trust language", () => {
    const matches = text.match(FORBIDDEN);
    expect(matches).toBeNull();
  });

  it("does not claim the app never makes a network request", () => {
    // The app DOES contact the backend for GET /health. If someone "simplifies"
    // the copy to "never makes network requests", this must fail.
    expect(/\bnever ?(makes|sends|initiates) ?(a )?network/.test(text)).toBe(false);
    expect(text.includes("health")).toBe(true);
  });

  it("explicitly states transaction data is not included in the backend request", () => {
    expect(text).toMatch(/no transaction (file|rows)/);
    expect(text).toMatch(/contains no analysis payload|no analysis payload/);
  });

  it("grounds local save in this device / this browser and no server backup", () => {
    expect(text).toMatch(/stored locally on this device/);
    expect(text).toMatch(/this browser's local indexeddb/);
    expect(text).toMatch(/not a backup/);
  });

  it("states what is not implemented rather than claiming secrecy", () => {
    expect(text).toMatch(/does not currently use|not currently/i);
    expect(privacy.notImplemented.items.length).toBeGreaterThanOrEqual(6);
  });
});
