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
    { kind: "new-recurring", title: "Unknown SaaS", detail: "New recurring charge", tag: "$89/month" },
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
      detail: "Both collaboration tools are billed to the same account.",
    },
  ] as { id: number; tier: Tier; finding: string; vendor: string; detail: string }[],
};