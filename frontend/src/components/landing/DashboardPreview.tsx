import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { dashboard } from "@/lib/mock";

const tierTone: Record<string, string> = {
  Detected: "bg-emerald-50 text-emerald-700",
  Likely: "bg-amber-50 text-amber-700",
  "Needs review": "bg-zinc-100 text-zinc-700",
};

export function DashboardPreview() {
  return (
    <section className="border-t border-line bg-surface py-16 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Product preview"
          title="A clear dashboard of what to review."
          sub="Illustrative sample data showing the shape of a future Sasscout analysis."
        />

        <div className="mt-12 overflow-hidden border border-line">
          <div className="flex items-center gap-1.5 border-b border-line bg-surface-muted px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
            <span className="ml-3 font-mono text-xs text-ink-3">Sasscout · Spend overview · Sample data</span>
          </div>

          <div className="grid gap-px bg-line md:grid-cols-4">
            <div className="bg-surface px-6 py-6">
              <p className="font-mono text-[11px] text-ink-3">monthly spend</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-ink">
                <AnimatedNumber value={dashboard.monthlyValue} variant="usd" />
              </p>
            </div>
            <div className="bg-surface px-6 py-6">
              <p className="font-mono text-[11px] text-ink-3">yearly spend</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-ink">
                <AnimatedNumber value={dashboard.yearlyValue} variant="usd" />
              </p>
            </div>
            <div className="bg-surface px-6 py-6">
              <p className="font-mono text-[11px] text-ink-3">vendors</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-ink">
                <AnimatedNumber value={dashboard.vendorsValue} suffix=" vendors" />
              </p>
            </div>
            <div className="bg-surface px-6 py-6">
              <p className="font-mono text-[11px] text-ink-3">need review</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-amber-700">
                <AnimatedNumber value={dashboard.itemsToReview} suffix=" items" />
              </p>
            </div>
          </div>

          <div className="border-t border-line px-6 py-6">
            <p className="font-mono text-xs text-ink-3">review queue</p>
            <ul className="mt-4 divide-y divide-line">
              {dashboard.reviewQueue.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tierTone[item.tier]}`}
                  >
                    {item.tier}
                  </span>
                  <p className="text-sm font-medium text-ink">{item.vendor}</p>
                  <p className="text-sm text-ink-2">{item.finding}</p>
                  <p className="mt-1 w-full text-sm leading-6 text-ink-2">{item.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-4 font-mono text-xs text-zinc-500">
          Illustrative preview — finding types shown here are real engine output; the numbers are sample data, not a real analysis.
        </p>
      </Container>
    </section>
  );
}