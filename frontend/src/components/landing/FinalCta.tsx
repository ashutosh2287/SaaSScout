import { Container } from "@/components/ui/Container";
import { CtaButton } from "@/components/ui/CtaButton";

export function FinalCta() {
  return (
    <section className="border-t border-line bg-ink py-20 sm:py-28">
      <Container className="flex flex-col items-center text-center">
        <h2 className="max-w-2xl font-display text-3xl leading-tight text-canvas sm:text-4xl">
          See what your software spend is really doing.
        </h2>
        <p className="mt-4 font-mono text-sm text-canvas/70">
          upload your transaction data · first audit in minutes
        </p>
        <div className="mt-8">
          <CtaButton href="/analyze">Analyze my spending</CtaButton>
        </div>
      </Container>
    </section>
  );
}