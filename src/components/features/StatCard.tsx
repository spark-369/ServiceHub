import type { ReactNode } from "react";

/**
 * Compact KPI tile for dashboards (payments, provider, admin). Keeps the metric
 * row visually consistent across roles.
 */
export default function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-400">{label}</p>
        {icon && <span className="text-slate-500">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-100">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
