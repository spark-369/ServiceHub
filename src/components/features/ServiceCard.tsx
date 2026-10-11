import type { Service } from "@/lib/types";
import { formatDuration, formatMoney } from "@/lib/format";
import { Avatar, Badge, Button, ButtonLink, Rating } from "@/components/ui";

/**
 * Service listing card. Extracted from the home/recommendations pages so the
 * two grids render identically. Icons are inline SVGs (not emoji) so the card
 * is legible on every platform and accessible.
 */
export default function ServiceCard({
  service,
  onViewReviews,
  matchScore,
}: {
  service: Service;
  onViewReviews?: (service: Service) => void;
  /** Optional AI relevance score (0–1) rendered as a "% match" badge. */
  matchScore?: number;
}) {
  const providerName = service.provider?.name ?? "Unknown provider";

  return (
    <div className="flex flex-col rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-sm transition-colors hover:border-slate-700">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-100">{service.name}</h3>
        {matchScore !== undefined ? (
          <Badge tone="success">{Math.round(matchScore * 100)}% match</Badge>
        ) : (
          <Badge tone="info">{service.category}</Badge>
        )}
      </div>

      <p className="mt-2 line-clamp-2 text-sm text-slate-400">
        {service.description}
      </p>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-baseline">
          <span className="text-2xl font-bold text-slate-100">
            {formatMoney(service.price)}
          </span>
          <span className="ml-1 text-sm text-slate-500">
            / {formatDuration(service.duration)}
          </span>
        </div>
        <Rating value={service.rating} count={service.reviewCount} />
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
        <Avatar name={providerName} size="sm" />
        <span className="truncate">{providerName}</span>
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-sm text-slate-400">
        <svg
          className="h-4 w-4 flex-shrink-0 text-slate-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 21s7-6.1 7-11a7 7 0 10-14 0c0 4.9 7 11 7 11z"
          />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        <span className="truncate">{service.location}</span>
      </div>

      <div className="mt-6 flex flex-col gap-2 pt-2">
        <ButtonLink href={`/services/${service.id}`} className="w-full">
          View Details
        </ButtonLink>
        {onViewReviews && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => onViewReviews(service)}
          >
            View Reviews ({service.reviewCount})
          </Button>
        )}
      </div>
    </div>
  );
}
