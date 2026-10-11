import type { Service } from "@/lib/types";
import ServiceCard from "./ServiceCard";
import { EmptyState, SkeletonGrid } from "@/components/ui";

const GRID = "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3";

/**
 * Renders a collection of services with built-in loading and empty states so
 * every page shows the same grid, skeletons and no-results message.
 */
export default function ServiceGrid({
  services,
  loading = false,
  onViewReviews,
  emptyTitle = "No services found",
  emptyDescription = "Try adjusting your search or filters.",
  emptyAction,
}: {
  services: Service[];
  loading?: boolean;
  onViewReviews?: (service: Service) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}) {
  if (loading) {
    return <SkeletonGrid count={6} className={GRID} />;
  }

  if (services.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
        icon={
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
            />
          </svg>
        }
      />
    );
  }

  return (
    <div className={GRID}>
      {services.map((service) => (
        <ServiceCard
          key={service.id}
          service={service}
          onViewReviews={onViewReviews}
        />
      ))}
    </div>
  );
}
