import Link from "next/link";
import { Container } from "@/components/ui/Container";

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white">
      <Container className="py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-700 text-xs font-bold text-white">
              S
            </span>
            <div>
              <p className="text-sm font-semibold text-zinc-900">Sasscout</p>
              <p className="text-sm text-zinc-600">SaaS-spend audit for small businesses.</p>
            </div>
          </div>
          <nav aria-label="Footer" className="flex gap-6">
            <Link href="/analyze" className="text-sm text-zinc-600 hover:text-zinc-900">
              Analyze my spending
            </Link>
            <Link href="/privacy" className="text-sm text-zinc-600 hover:text-zinc-900">
              Privacy &amp; data
            </Link>
          </nav>
        </div>
        <p className="mt-8 text-xs text-zinc-500">
          © {new Date().getFullYear()} Sasscout. Software-spend audit, not software management.
        </p>
      </Container>
    </footer>
  );
}