import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const sources = [
  { icon: "CC", label: "Credit cards" },
  { icon: "BA", label: "Bank accounts" },
  { icon: "CO", label: "Corporate cards" },
  { icon: "PP", label: "PayPal" },
];

export function CoreValue() {
  return (
    <section id="product" className="scroll-mt-20 border-t border-line bg-canvas py-16 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="The problem"
          title="Your software spend is harder to see than you think."
        />
        <div className="mt-10 grid gap-8 lg:grid-cols-2 lg:items-center">
          <p className="text-lg leading-8 text-zinc-600">
            Software payments rarely appear in one place. They hide across bank
            accounts, credit cards, corporate cards, and PayPal — often billed to
            different teams. Sasscout pulls those scattered charges together so
            the full picture is visible at once.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {sources.map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-surface px-4 py-4 shadow-sm"
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-sm font-bold text-zinc-700"
                >
                  {s.icon}
                </span>
                <span className="text-sm font-medium text-zinc-800">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}