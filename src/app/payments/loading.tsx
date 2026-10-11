import { Skeleton } from "@/components/ui";

/** Payments dashboard skeleton — KPI row + transaction rows. */
export default function PaymentsLoading() {
  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-lg" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
