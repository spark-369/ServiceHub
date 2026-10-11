import { formatRating } from "@/lib/format";

/**
 * Star rating display. Renders SVG stars (rather than the emoji the pages used)
 * so ratings are accessible and never depend on emoji fonts.
 */
export default function Rating({
  value,
  count,
  className = "",
}: {
  value: number;
  /** Optional review count rendered as "(12)". */
  count?: number;
  className?: string;
}) {
  const rounded = Math.round(value);
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="flex" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, index) => (
          <svg
            key={index}
            className={`h-4 w-4 ${
              index < rounded ? "text-amber-400" : "text-slate-700"
            }`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L10 14.77l-5.2 2.73.99-5.78-4.21-4.1 5.82-.85L10 1.5z" />
          </svg>
        ))}
      </span>
      <span className="text-sm text-slate-300">{formatRating(value)}</span>
      {count !== undefined && (
        <span className="text-sm text-slate-500">({count})</span>
      )}
      <span className="sr-only">
        Rated {formatRating(value)} out of 5
        {count !== undefined ? ` from ${count} reviews` : ""}
      </span>
    </span>
  );
}
