import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";

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
    <section id="how-it-works" className="scroll-mt-20 border-t border-line bg-surface py-16 sm:py-24">
      <Container>
        <SectionHeading eyebrow="How it works" title="Three steps to a clearer picture." />
        <ol className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.n}>
              <Reveal delay={i * 120} className="border border-line bg-surface p-6">
                <span className="font-mono text-xs text-brand">step {s.n}</span>
                <h3 className="mt-3 font-display text-2xl text-ink">{s.title}</h3>
                <p className="mt-2 leading-7 text-ink-2">{s.body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}