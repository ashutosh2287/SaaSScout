import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// STEP 33 — accessibility regression guards (source-level).
//
// These scan our own component/page source the same way trust-language.test.ts
// does, so no DOM/runtime dependency is required. They protect two concrete
// accessibility behaviours delivered in STEP 33:
//
//   1. Reduced motion — every non-zero animation utility (`animate-*`) must be
//      paired with the Tailwind `motion-reduce:animate-none` fallback so
//      spinning/pulsing respects `prefers-reduced-motion` (WCAG 2.3.3).
//   2. Async announcements — user-facing loading/error/outcome regions that
//      appear asynchronously must be exported as polite live regions
//      (`role="status"`), so assistive technology is notified without stealing
//      focus.

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (/\.(tsx|ts)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const ROOT = join(__dirname, "..", "..", "src");
// FILES scanned for animation utilities: every component + page.
const ALL_SRC = walk(join(ROOT, "components"));
ALL_SRC.push(...walk(join(ROOT, "app")));

// Async stateful regions we deliberately expose via role="status". Any future
// async user-facing surface should be added here (and given role="status").
const ASYNC_LIVE_REGION_FILES = [
  join(ROOT, "app", "analyze", "page.tsx"), // parsing
  join(ROOT, "components", "analyze", "SaveAnalysisCard.tsx"), // save
  join(ROOT, "app", "analyze", "saved", "page.tsx"), // list load / delete
  join(ROOT, "app", "analyze", "saved", "[id]", "page.tsx"), // detail load
  join(ROOT, "components", "layout", "ServiceStatusBar.tsx"), // service check
];

describe("STEP 33 — reduced-motion fallback", () => {
  it("every animate-* utility is paired with motion-reduce:animate-none", () => {
    const offenders: { file: string; line: string }[] = [];
    for (const file of ALL_SRC) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, idx) => {
        // Find animation utilities in className/tailwind class strings.
        const anims = line.match(/\banimate-(spin|pulse|bounce|ping)\b/g);
        if (!anims || anims.length === 0) return;
        const reduced = line.includes("motion-reduce:animate-none");
        if (!reduced) {
          offenders.push({
            file: `${file.replace(join(__dirname, "..", ".."), "")}:${idx + 1}`,
            line: line.trim(),
          });
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});

describe("STEP 33 — async live-region announcements", () => {
  it.each(ASYNC_LIVE_REGION_FILES)("%s exposes role=status", (file) => {
    const src = readFileSync(file, "utf8");
    expect(src).toMatch(/role="status"/);
  });
});
