import { Skeleton } from "@/components/ui";

/** Admin console skeleton — title, tab bar and a table placeholder. */
export default function AdminLoading() {
  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8">
      <Skeleton className="h-8 w-56" />
      <div className="flex gap-8 border-b border-slate-800 pb-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-6 w-24" />
        ))}
      </div>
      <Skeleton className="h-14 w-full rounded-lg" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
