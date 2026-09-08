export type ReviewItem = {
  kind: "price-change" | "possible-overlap" | "new-recurring";
  title: string;
  detail: string;
  tag: string;
};

export type Tier = "Detected" | "Likely" | "Needs review";

export const heroSpend = {
  softwareSpendValue: 57840,
  per: "/ year",
  vendors: "43 vendors",
  itemsToReview: "14 items to review",
  recurringPatterns: "27 likely recurring",
  reviewQueue: [
    { kind: "price-change", title: "Adobe", detail: "Price change", tag: "+20%" },
    { kind: "possible-overlap", title: "Slack + Teams", detail: "Possible overlap", tag: "Overlap" },
    // Step 27 — `unclear_ownership` is "recurring software the engine
    // could not identify by name or pattern", not a "new recurring
    // charge". The old wording implied a fresh subscription; the
    // honest read is the opposite — a sustained bill with no owner.
    { kind: "unclear-ownership", title: "Unknown SaaS", detail: "Recurring charge we can't identify", tag: "Needs your confirmation" },
  ] as ReviewItem[],
};

export const dashboard = {
  monthlyValue: 4820,
  yearlyValue: 57840,
  vendorsValue: 43,
  itemsToReview: 14,
  reviewQueue: [
    {
      id: 1,
      tier: "Detected" as Tier,
      finding: "Recurring payment pattern detected",
      vendor: "Adobe",
      detail: "Adobe Creative Cloud renews $249.99 monthly at the same amount.",
    },
    {
      id: 2,
      tier: "Likely" as Tier,
      finding: "Significant payment change detected",
      vendor: "Notion",
      detail: "Monthly charge rose 32% six weeks ago — possible seat increase.",
    },
    {
      id: 3,
      tier: "Needs review" as Tier,
      finding: "Possible overlap between tools",
      vendor: "Slack + Teams",
      // Step 26 — the engine's honest wording is "both are classified
      // as team-collaboration software in the current period". The old
      // line ("billed to the same account") implied a shared payment
      // source that the engine does not establish; the overlap
      // detector only looks at subcategory, recurring status, and
      // interval. The next step is to confirm both are still in use.
      detail: "Both are classified as team-collaboration software and billed on a recurring cadence in the current period.",
    },
  ] as { id: number; tier: Tier; finding: string; vendor: string; detail: string }[],
};