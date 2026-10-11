/**
 * Indeterminate loading spinner.
 *
 * Mirrors the single spinner style already used across the app (indigo ring on
 * the dark background) so callers never re-declare the animate-spin markup.
 */

const SIZES = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-12 w-12 border-b-2",
} as const;

export interface SpinnerProps {
  size?: keyof typeof SIZES;
  className?: string;
  /** Accessible label announced to screen readers. */
  label?: string;
}

export default function Spinner({
  size = "md",
  className = "",
  label = "Loading",
}: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block animate-spin rounded-full border-indigo-500 ${SIZES[size]} ${className}`}
    >
      <span className="sr-only">{label}…</span>
    </span>
  );
}

/** Centered spinner used as a full-panel loading state. */
export function SpinnerPanel({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <Spinner size="lg" label={label} />
    </div>
  );
}
