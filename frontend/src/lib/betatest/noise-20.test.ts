import { describe, expect, it } from "vitest";
import { parseFile } from "../parse";
import { buildStatement, toCsv, SOFTWARE_EXPECTED_KEYS } from "./fixtures";
import { parseAndAnalyze, classificationByKey } from "./pipeline";

const SOFTWARE_CATEGORIES = new Set(["likely_saas", "likely_software"]);
const softwareSeedSet = new Set(SOFTWARE_EXPECTED_KEYS);

function transformStatement(fn: (d: string, seed: string) => string): {
  csv: string;
  seedByTriple: Map<string, string>;
} {
  const statement = buildStatement();
  const seedByTriple = new Map<string, string>();
  const rows = statement.rows.map((r, i) => {
    const seed = statement.seedByRowIndex[i];
    if (seed && softwareSeedSet.has(seed)) {
      const description = fn(r.description, seed);
      seedByTriple.set(`${r.date}|${description}|${r.amount}`, seed);
      return { ...r, description };
    }
    seedByTriple.set(`${r.date}|${r.description}|${r.amount}`, seed ?? "noise");
    return r;
  });
  return { csv: toCsv(rows, ["Date", "Description", "Amount"]), seedByTriple };
}

// Realistic bank-emitted variations that must NOT break identity.
const benignTransforms: { name: string; fn: (d: string, seed: string) => string }[] = [
  { name: "lowercase", fn: (d) => d.toLowerCase() },
  { name: "whitespace-padded", fn: (d) => `  ${d.toUpperCase().replace(/\*/g, " ")}  ` },
  { name: "double-spaces", fn: (d) => d.replace(/\s+/g, "  ") },
  { name: "store-locator", fn: (d) => `${d} #${(d.length * 7) % 90}931`.toUpperCase() },
  { name: "first-token", fn: (d) => d.split(/\s+/)[0].toUpperCase() },
];

describe("STEP 20 — descriptor noise must not break software detection", () => {
  const statement = buildStatement();

  it("establishes a clean baseline control", async () => {
    const snapshot = await parseAndAnalyze(toCsv(statement.rows, ["Date", "Description", "Amount"]), "control.csv");
    for (const key of SOFTWARE_EXPECTED_KEYS) {
      const cat = snapshot.classification.merchants.find((m) => m.normalizedKey === key)?.classification.category;
      expect(SOFTWARE_CATEGORIES.has(cat!), `${key} control`).toBe(true);
    }
  });

  for (const t of benignTransforms) {
    it(`survives "${t.name}" and classifies every software merchant`, async () => {
      const snapshot = await parseAndAnalyze(transformStatement(t.fn).csv, `${t.name}.csv`);
      const byKey = classificationByKey(snapshot);
      const missingNow = SOFTWARE_EXPECTED_KEYS.filter((k) => {
        const cat = byKey.get(k);
        return !cat || !SOFTWARE_CATEGORIES.has(cat);
      });
      expect(missingNow, `merchants broken by "${t.name}": ${missingNow.join(", ")}`).toEqual([]);
    });
  }

  it("typo attack is measured and never invents a software claim", async () => {
    const corruption: Record<string, string> = {
      adobe: "ADBEO", slack: "SLAC", figma: "FGISMA", microsoft: "MSFTCORP",
      netflix: "NETFLEX", spotify: "SPOTFY", zoom: "ZOOMX", openai: "OPENAL",
      shopify: "SHOPIFY2", trello: "TERLLO", atlassian: "ATLASSIANN",
      salesforce: "SALESFC", hubspot: "HUBSPET", dropbox: "DROPBO",
      canva: "CANVR", github: "GITHUBBB", notion: "NOTIN",
    };
    const { csv, seedByTriple } = transformStatement((d, seed) => {
      const bad = corruption[seed];
      if (!bad) return d;
      const upper = d.toUpperCase();
      const key = seed.toUpperCase();
      if (!upper.includes(key)) return d;
      return upper.split(key).join(bad);
    });
    const snapshot = await parseAndAnalyze(csv, "typo.csv");
    const byKey = classificationByKey(snapshot);
    const survived = SOFTWARE_EXPECTED_KEYS.filter((k) => {
      const cat = byKey.get(k);
      return cat !== undefined && SOFTWARE_CATEGORIES.has(cat);
    });
    console.log(`typo attack: survived ${survived.length}/${SOFTWARE_EXPECTED_KEYS.length} [${survived.join(", ")}]`);
    // Safety: EVERY software-classified identity must trace back (via at least
    // one of its transactions) to a known software seed. A typo may degrade a
    // vendor to unknown, but it must never fabricate a software claim where no
    // software vendor exists.
    const softwareIdentities = new Map<string, Set<string>>();
    for (const t of snapshot.merchants.transactions) {
      const c = byKey.get(t.merchant.normalizedKey ?? "");
      if (c && SOFTWARE_CATEGORIES.has(c)) {
        const triple = `${t.date}|${t.description}|${t.amount}`;
        const seed = seedByTriple.get(triple);
        if (seed) {
          if (!softwareIdentities.has(t.merchant.normalizedKey!)) softwareIdentities.set(t.merchant.normalizedKey!, new Set());
          softwareIdentities.get(t.merchant.normalizedKey!)!.add(seed);
        }
      }
    }
    const fabricated = [...softwareIdentities.entries()]
      .filter(([, seeds]) => [...seeds].every((s) => s === "noise" || !softwareSeedSet.has(s)))
      .map(([k]) => k);
    expect(fabricated, `typo attack fabricated software claims: ${fabricated.join(", ")}`).toEqual([]);
    // Graceful degradation accepted and measured; never a silent wrong answer.
    expect(survived.length).toBeGreaterThanOrEqual(1);
  });

  it("error rows never crash the pipeline and stay enumerated honestly", async () => {
    const rows = buildStatement().rows.slice(0, 200);
    const lines: string[][] = [["Date", "Description", "Amount"]];
    for (const r of rows) lines.push([r.date, r.description, r.amount.toFixed(2)]);
    lines.push(["not-a-date", "ADOBE *CREATIVE CLOUD", "not-an-amount"]);
    lines.push(["2026-03-01", "GROCERY STORE", ""]);
    lines.push(["bogus", "TOTAL", "123"]);
    const csv = lines.map((l) => l.join(",")).join("\n");
    const p = await parseFile(new File([csv], "dirty.csv", { type: "text/csv" }));
    expect(p.errors.length).toBeGreaterThanOrEqual(2);
    expect(p.parsedRows).toBe(rows.length);
    const snapshot = await (await import("./pipeline")).analyzeParseResult(p);
    expect(snapshot.report.file.parsedRows).toBe(rows.length);
  });
});