// Step 26 — curated subcategory map for software merchants.
//
// Used to detect INTRA-PERIOD overlap: two distinct recurring software
// merchants in the same report that share a subcategory (e.g. Slack + Teams
// in "team-collaboration") are flagged as a `possible_overlap` finding. This
// is the only kind that names a concrete user check (e.g. "do you need both?")
// without ever claiming one is a duplicate of the other.
//
// Honesty rules baked in here:
//  - Small and CURATED. Two overlapping merchants must both be in this map
//    with the SAME subcategory; merchants not in the map cannot overlap.
//  - Each merchant appears under EXACTLY ONE subcategory. A vendor that
//    spans categories (e.g. Microsoft could be "collaboration" or
//    "productivity") gets the category that drives the most useful
//    overlap question. There is no fuzzy matching and no "all of the above".
//  - Subcategories are coarse on purpose. "productivity" groups Notion and
//    Google Workspace; "team-collaboration" groups Slack and Teams; "design"
//    groups Figma and Adobe. A wider grouping would over-claim.
//
// The current subcategory set covers the most common pairs an owner would
// ask about. Adding to it is a deliberate, named change — review the
// existing pairs before extending.

export type SoftwareSubcategory =
  | "team-collaboration"
  | "communication"
  | "productivity"
  | "file-storage"
  | "developer-tools"
  | "design"
  | "crm-sales"
  | "marketing-analytics"
  | "accounting-finance"
  | "security-identity"
  | "hosting-infrastructure"
  | "project-management"
  | "customer-support";

// Subcategory -> merchant normalizedKey set. Curated and small. Every
// merchant appears under exactly one subcategory so an overlap finding is
// unambiguous: same subcategory, not "shares any of two".
export const SUBCATEGORY_MEMBERS: Record<SoftwareSubcategory, ReadonlySet<string>> = {
  "team-collaboration": new Set(["slack", "trello", "atlassian", "notion"]),
  communication: new Set(["zoom", "discord", "microsoft"]),
  productivity: new Set(["google"]),
  "file-storage": new Set(["dropbox"]),
  "developer-tools": new Set(["github", "gitlab"]),
  design: new Set(["figma", "adobe", "canva"]),
  "crm-sales": new Set(["salesforce"]),
  "marketing-analytics": new Set(["hubspot"]),
  "accounting-finance": new Set(["xero", "quickbooks"]),
  "security-identity": new Set(["okta", "1password"]),
  "hosting-infrastructure": new Set(["aws", "digitalocean", "heroku"]),
  "project-management": new Set(["monday", "asana"]),
  "customer-support": new Set(["zendesk", "intercom"]),
};

// Subcategories where having TWO billed tools at the same time is plausibly
// a duplicate. "Productivity" and "team-collaboration" sit at the top;
// "hosting-infrastructure" and "developer-tools" do NOT — multiple hosted
// environments or repos are normal and not a sign of waste. The
// `overlap-eligible` subcategory set is the gate.
export const OVERLAP_ELIGIBLE_SUBCATEGORIES: ReadonlySet<SoftwareSubcategory> = new Set([
  "team-collaboration",
  "communication",
  "design",
  "crm-sales",
  "marketing-analytics",
  "project-management",
  "customer-support",
]);

export function subcategoryFor(normalizedKey: string | null): SoftwareSubcategory | null {
  if (normalizedKey === null) return null;
  for (const [sub, members] of Object.entries(SUBCATEGORY_MEMBERS) as [SoftwareSubcategory, ReadonlySet<string>][]) {
    if (members.has(normalizedKey)) return sub;
  }
  return null;
}
