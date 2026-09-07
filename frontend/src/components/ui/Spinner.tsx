// STEP 1 primitive — spinner. Stops spinning under reduced motion (static ring
// conveys intent without motion). Assumes usage inside a role="status" region.

const SIZES = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
} as const;

export function Spinner({ size = "md", className = "" }: { size?: keyof typeof SIZES; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`${SIZES[size]} animate-spin text-brand motion-reduce:animate-none ${className}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  );
}