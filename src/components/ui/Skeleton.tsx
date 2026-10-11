/**
 * Loading placeholders.
 *
 * Prefer these over a centered spinner for content regions: they reserve the
 * final layout, so the page does not shift when data arrives.
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-800 ${className}`}
      aria-hidden="true"
    />
  );
}

/** A block of text lines, with the last line shortened. */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={`h-4 ${index === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}

/** Placeholder matching the home/recommendation service card shape. */
export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="mt-4">
        <SkeletonText lines={2} />
      </div>
      <div className="mt-6 flex items-center justify-between">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="mt-6 h-10 w-full" />
    </div>
  );
}

/** Grid of card skeletons for list/collection pages. */
export function SkeletonGrid({
  count = 6,
  className = "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className} role="status" aria-label="Loading content">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Rows placeholder for table-based admin views. */
export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading table">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
