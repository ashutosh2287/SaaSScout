// STEP 1 primitive — shimmer placeholder used while routes render. Always
// aria-hidden: it is decoration until the real content (and its semantics)
// arrive.

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-surface-muted motion-reduce:animate-none ${className}`}
    />
  );
}