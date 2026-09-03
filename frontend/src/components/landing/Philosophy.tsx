import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const tiers = [
  {
    label: "Detected",
    tone: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-700",
    body: "Strong recurring payment pattern detected.",
  },
  {
    label: "Likely",
    tone: "bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
    body: "Possible recurring pattern or notable change detected.",
  },
  {
    label: "Needs review",
    tone: "bg-zinc-100 text-zinc-700",
    dot: "bg-zinc-400",
    body: "Worth investigating, such as possible overlap between tools.",
  },
];

export function Philosophy() {
  return (
    <section id="why" className="scroll-mt-20 border-t border-zinc-200 bg-zinc-50 py-16 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Product philosophy"
          title="Evidence before assumptions."
          sub="Sasscout never presents uncertain analysis as absolute fact. Every finding is labeled by how confident we are in it, so you always know what to trust."
        />
        <ul className="mt-10 space-y-4">
          {tiers.map((t) => (
            <li
              key={t.label}
              className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm"
            >
              <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${t.dot}`} />
              <span className={`w-32 shrink-0 rounded-full px-2.5 py-1 text-center text-xs font-semibold ${t.tone}`}>
                {t.label}
              </span>
              <p className="text-sm leading-6 text-zinc-600 sm:text-base">{t.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}