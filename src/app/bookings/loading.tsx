import { Skeleton } from "@/components/ui";

/** Bookings list skeleton — a header plus stacked booking rows. */
export default function BookingsLoading() {
  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-10 w-48" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
