import { Container } from "@/components/ui/Container";
import { CtaButton } from "@/components/ui/CtaButton";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Reveal } from "@/components/ui/Reveal";
import { heroSpend } from "@/lib/mock";

const badgeStyles: Record<string, string> = {
  "price-change": "bg-zinc-100 text-zinc-700",
  "possible-overlap": "bg-zinc-100 text-zinc-700",
  "new-recurring": "bg-emerald-50 text-emerald-700",
};

export function Hero() {
  return (
    <section className="border-b border-line bg-canvas">
      <Container className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1fr_28rem] lg:gap-16">
        <Reveal className="max-w-xl">
          <p className="font-mono text-xs text-ink-3">
            <span className="text-brand">●</span> field report 001 — spend scan
          </p>
          <h1 className="mt-5 font-display text-4xl leading-[1.05] text-ink sm:text-5xl">
            The software spend your business should review, printed like a scout&apos;s file.
          </h1>
          <p className="mt-6 text-lg leading-8 text-ink-2">
            Upload your bank or credit-card statements and get a software-spend audit in minutes.
            Files stay on your device.
          </p>
          <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <CtaButton href="/analyze">Analyze my spending</CtaButton>
            <p className="font-mono text-xs text-ink-3">no account · local-only</p>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <div className="border border-line bg-surface">
            <div className="flex items-baseline justify-between border-b border-line px-5 py-3">
              <p className="font-mono text-xs text-ink-3">software spend</p>
              <p className="font-mono text-xs text-ink-3">{heroSpend.per}</p>
            </div>
            <div className="px-5 py-5">
              <p className="font-display text-4xl tracking-tight text-ink">
                <AnimatedNumber value={heroSpend.softwareSpendValue} variant="usd" />
              </p>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 font-mono text-sm text-ink-2">
                <span className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-ink-3" />
                  {heroSpend.vendors}
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  {heroSpend.itemsToReview}
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                  {heroSpend.recurringPatterns}
                </span>
              </div>
            </div>

            <div className="border-t border-line px-5 py-4">
              <p className="font-mono text-xs text-ink-3">review queue</p>
              <ul className="mt-3 divide-y divide-line">
                {heroSpend.reviewQueue.map((item) => (
                  <li key={item.title} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                      <p className="text-xs text-ink-2">{item.detail}</p>
                    </div>
                    <span
                      className={`shrink-0 font-mono text-xs font-medium ${badgeStyles[item.kind]}`}
                    >
                      {item.tag}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-line bg-surface-muted px-5 py-3">
              <p className="font-mono text-xs text-ink-3">
                Illustrative preview — findings of this kind come from the engine; the amounts here are sample data, not your real spend.
              </p>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}