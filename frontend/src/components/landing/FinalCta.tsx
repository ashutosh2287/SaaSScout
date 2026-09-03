import { Container } from "@/components/ui/Container";
import { CtaButton } from "@/components/ui/CtaButton";

export function FinalCta() {
  return (
    <section className="border-t border-zinc-200 bg-zinc-950 py-20 sm:py-28">
      <Container className="flex flex-col items-center text-center">
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          See what your software spend is really doing.
        </h2>
        <p className="mt-4 max-w-xl text-lg leading-8 text-zinc-400">
          Upload your transaction data and get your first SaaS spend audit.
        </p>
        <div className="mt-8">
          <CtaButton href="/analyze">Analyze my spending</CtaButton>
        </div>
      </Container>
    </section>
  );
}