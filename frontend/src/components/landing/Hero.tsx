import { Container } from "@/components/ui/Container";
import { CtaButton } from "@/components/ui/CtaButton";
import { heroSpend } from "@/lib/mock";

const badgeStyles: Record<string, string> = {
  "price-change": "bg-zinc-100 text-zinc-700",
  "possible-overlap": "bg-zinc-100 text-zinc-700",
  "new-recurring": "bg-emerald-50 text-emerald-700",
};

export function Hero() {
  return (
    <section className="bg-white">
      <Container className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-2 lg:gap-16">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl sm:leading-[1.1]">
            Find the software spending your business should review.
          </h1>
          <p className="mt-6 text-lg leading-8 text-zinc-600">
            Upload your bank or credit-card statements and get a software-spend audit
            in minutes.
          </p>
          <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <CtaButton href="/analyze">Analyze my spending</CtaButton>
            <p className="text-sm text-zinc-500">No bank connection required.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-zinc-500">Software spend</p>
          </div>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
            {heroSpend.softwareSpend}
            <span className="text-base font-medium text-zinc-500">{heroSpend.per}</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-600">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-zinc-300" />
              {heroSpend.vendors}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              {heroSpend.itemsToReview}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {heroSpend.recurringPatterns}
            </span>
          </div>

          <div className="mt-6 border-t border-zinc-100 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Review queue
            </p>
            <ul className="mt-3 space-y-3">
              {heroSpend.reviewQueue.map((item) => (
                <li
                  key={item.title}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">{item.title}</p>
                    <p className="text-xs text-zinc-500">{item.detail}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badgeStyles[item.kind]}`}
                  >
                    {item.tag}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-5 text-xs text-zinc-500">
            Illustrative preview of Sasscout sample data — not an actual analysis.
          </p>
        </div>
      </Container>
    </section>
  );
}