import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { BrandMark } from "@/components/layout/BrandMark";

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <Container className="py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <BrandMark />
            <p className="text-sm text-ink-2">SaaS-spend audit for small businesses.</p>
          </div>
          <nav aria-label="Footer" className="flex gap-6">
            <Link href="/analyze" className="text-sm text-ink-2 transition-colors hover:text-ink">
              Analyze my spending
            </Link>
            <Link href="/privacy" className="text-sm text-ink-2 transition-colors hover:text-ink">
              Privacy &amp; data
            </Link>
          </nav>
        </div>
        <p className="mt-8 text-xs text-ink-3">
          © {new Date().getFullYear()} Sasscout. Software-spend audit, not software management.
        </p>
      </Container>
    </footer>
  );
}