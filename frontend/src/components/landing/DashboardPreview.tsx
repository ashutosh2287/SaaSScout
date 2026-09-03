import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { dashboard } from "@/lib/mock";

const tierTone: Record<string, string> = {
  Detected: "bg-emerald-50 text-emerald-700",
  Likely: "bg-amber-50 text-amber-700",
  "Needs review": "bg-zinc-100 text-zinc-700",
};

export function DashboardPreview() {
  return (
    <section className="border-t border-zinc-200 bg-white py-16 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Product preview"
          title="A clear dashboard of what to review."
          sub="Illustrative sample data showing the shape of a future Sasscout analysis."
        />

        <div className="mt-12 overflow-hidden rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
            <span className="ml-3 text-xs font-medium text-zinc-500">Sasscout · Spend overview · Sample data</span>
          </div>

          <div className="grid gap-px bg-zinc-200 md:grid-cols-4">
            <div className="bg-white px-6 py-6">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Monthly spend</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">{dashboard.monthly}</p>
            </div>
            <div className="bg-white px-6 py-6">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Yearly spend</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">{dashboard.yearly}</p>
            </div>
            <div className="bg-white px-6 py-6">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Vendors</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">{dashboard.vendors}</p>
            </div>
            <div className="bg-white px-6 py-6">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Need review</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-amber-700">
                {dashboard.itemsToReview} items
              </p>
            </div>
          </div>

          <div className="border-t border-zinc-200 px-6 py-6">
            <p className="text-sm font-semibold text-zinc-900">Review queue</p>
            <ul className="mt-4 space-y-4">
              {dashboard.reviewQueue.map((item) => (
                <li key={item.id} className="rounded-xl border border-zinc-100 p-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tierTone[item.tier]}`}
                    >
                      {item.tier}
                    </span>
                    <p className="text-sm font-medium text-zinc-900">{item.vendor}</p>
                    <p className="text-sm text-zinc-500">{item.finding}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{item.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-4 text-xs text-zinc-500">
          This is mock product-preview data, not a real Sasscout analysis result.
        </p>
      </Container>
    </section>
  );
}