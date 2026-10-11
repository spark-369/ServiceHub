import type { ReactNode } from "react";

/**
 * Consistent empty/no-results state: icon, title, description and an optional
 * primary action. Replaces the ad-hoc "No X found" blocks scattered per page.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-900/40 px-6 py-16 text-center">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-400">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-100">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-slate-400">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
