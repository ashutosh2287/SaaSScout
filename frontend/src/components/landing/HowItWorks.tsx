import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const steps = [
  {
    n: "01",
    title: "Upload",
    body: "Upload your CSV or XLSX transaction data.",
  },
  {
    n: "02",
    title: "Analyze",
    body: "Sasscout identifies software spending, recurring payments, and patterns worth reviewing.",
  },
  {
    n: "03",
    title: "Review",
    body: "Get a clear list of findings with evidence and confidence levels.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-t border-zinc-200 bg-white py-16 sm:py-24">
      <Container>
        <SectionHeading eyebrow="How it works" title="Three steps to a clearer picture." />
        <ol className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <span className="text-sm font-semibold tracking-wider text-emerald-700">{s.n}</span>
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-zinc-900">{s.title}</h3>
              <p className="mt-2 leading-7 text-zinc-600">{s.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}