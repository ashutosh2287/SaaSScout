import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Forbidden-language regression guard.
//
// Sasscout must never make direct, unsupported claims that the user is
// wasting money, can save a specific amount, should cancel something, or
// that a subscription is definitely unused. Estimates must stay labelled as
// signals, not facts.
//
// Legitimate text IS allowed — specifically conservative disclaimers that
// negate a forbidden claim ("not confirmed savings", "not guaranteed").
// This test fails only on unsupported, non-negated occurrences in the
// user-facing analysis UI. It deliberately scans components' own source
// (string literals / JSX text) so future copy cannot regress.
//
// Root cause, not symptom: one shared scanner covering every node under
// src/components/analyze and the landing sections, so a new "you can save"
// headline anywhere in the UI is caught once.

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(tsx|ts)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const ROOT = join(__dirname, "..");
const UI_DIRS = [join(ROOT, "components", "analyze"), join(ROOT, "components", "landing")];

// Terms that imply a direct, unsupported outcome. Lowercased.
// "cancel" is excluded from the broad scan (code variables trigger false positives);
// cancel-CTA detection is handled by targeted phrase assertions in the second test.
const FORBIDDEN_RE =
  /\bsavings\b|\bwasted?\b|\bguarantee[ds]?\b|\bdefinitely\b|\bunused\b/;

// A line is safe if the forbidden term is negated (a disclaimer, not a claim).
function isSafe(line: string): boolean {
  const lower = line.toLowerCase();
  if (/not\s+|\bcannot\b|\bnever\b|(don't|doesn't)\b/.test(lower)) return true;
  return false;
}

describe("unsupported waste/savings claims in analysis UI", () => {
  const offenders: { file: string; line: string }[] = [];

  for (const dir of UI_DIRS) {
    if (!existsSync(dir)) continue;
    for (const file of walk(dir)) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, idx) => {
        if (FORBIDDEN_RE.test(line.toLowerCase()) && !isSafe(line)) {
          offenders.push({ file: `${file.replace(ROOT, "")}:${idx + 1}`, line: line.trim() });
        }
      });
    }
  }

  it("contains no direct waste/savings/cancel claims", () => {
    expect(offenders).toEqual([]);
  });

  it("does not describe spending as proof or as a confirmed saving outside negated disclaimers", () => {
    // Fails on UX copy implying savings or guaranteed outcomes; the surviving
    // legit uses are all negations already proven by the first assertion.
    const files = walk(join(ROOT, "components", "analyze"));
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toMatch(/\byou (can|should) (save|cancel)\b/i);
      expect(src, file).not.toMatch(/\you'?re wasting\b/i);
    }
  });
});

function existsSync(p: string): boolean {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}