import { SkeletonGrid } from "@/components/ui";

/**
 * Route-level loading UI. Renders the same grid the service pages resolve to,
 * so the shell does not jump when data arrives.
 */
export default function Loading() {
  return (
    <div className="px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto mb-8 max-w-xl space-y-3 text-center">
        <div className="mx-auto h-9 w-72 animate-pulse rounded-md bg-slate-800" />
        <div className="mx-auto h-5 w-96 animate-pulse rounded-md bg-slate-800" />
      </div>
      <SkeletonGrid count={6} />
    </div>
  );
}
