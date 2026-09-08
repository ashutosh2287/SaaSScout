import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { BrandMark } from "@/components/layout/BrandMark";
import { privacy } from "@/lib/privacy/content";

// Static, presentation-only page. This component holds no state and makes no
// network requests; it only renders the data-flow copy from the privacy
// content model so that the explanation always matches the implementation.
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <Container className="flex h-16 items-center justify-between">
          <BrandMark />
          <Link
            href="/analyze"
            className="text-sm font-medium text-ink-2 transition-colors hover:text-ink"
          >
            Analyze my spending
          </Link>
        </Container>
      </header>

      <main className="px-6 py-12 sm:py-16">
        <Container className="max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            {privacy.pageTitle}
          </h1>
          <div className="mt-4 space-y-4 leading-7 text-zinc-600">
            {privacy.intro.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>

          {/* Transaction-data path */}
          <section aria-labelledby="txn-heading" className="mt-10">
            <h2 id="txn-heading" className="text-xl font-semibold tracking-tight text-zinc-900">
              {privacy.transactionPath.heading}
            </h2>
            {/* Numbered list is the accessible textual equivalent of the data-flow
                diagram: it does not rely on color or arrows to convey meaning. */}
            <ol className="mt-6 space-y-4">
              {privacy.transactionPath.steps.map((s, i) => (
                <li
                  key={s.title}
                  className="flex items-start gap-4 border border-line bg-surface p-5"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-brand-ink"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-zinc-900">{s.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-6 rounded-sm border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
              {privacy.transactionPath.note}
            </p>
          </section>

          {/* Backend health path — visually separated from transaction data */}
          <section
            aria-labelledby="backend-heading"
            className="mt-12 rounded-sm border-2 border-zinc-300 bg-zinc-50 p-6"
          >
            <h2 id="backend-heading" className="text-xl font-semibold tracking-tight text-zinc-900">
              {privacy.backend.heading}
            </h2>
            <p className="mt-2 leading-7 text-zinc-600">{privacy.backend.intro}</p>

            <div className="mt-4">
              <span className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-surface px-3 py-2 font-mono text-sm text-zinc-800">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
                {privacy.backend.requestBadge}
              </span>
            </div>

            <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-6 text-zinc-700">
              {privacy.backend.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>

            <p className="mt-4 border-t border-zinc-200 pt-4 text-sm leading-6 text-zinc-600">
              {privacy.backend.closing}
            </p>
          </section>

          {/* Storage */}
          <section aria-labelledby="storage-heading" className="mt-12">
            <h2 id="storage-heading" className="text-xl font-semibold tracking-tight text-zinc-900">
              {privacy.storage.heading}
            </h2>
            <p className="mt-2 leading-7 text-zinc-600">{privacy.storage.intro}</p>
            <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-6 text-zinc-700">
              {privacy.storage.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm leading-6 text-zinc-500">{privacy.storage.note}</p>
          </section>

          {/* Not implemented */}
          <section aria-labelledby="notimpl-heading" className="mt-12">
            <h2 id="notimpl-heading" className="text-xl font-semibold tracking-tight text-zinc-900">
              {privacy.notImplemented.heading}
            </h2>
            <p className="mt-2 leading-7 text-zinc-600">{privacy.notImplemented.intro}</p>
            <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-6 text-zinc-700">
              {privacy.notImplemented.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm leading-6 text-zinc-500">{privacy.notImplemented.closing}</p>
          </section>
        </Container>
      </main>
    </div>
  );
}
