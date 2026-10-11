import type { HTMLAttributes, ReactNode } from "react";

/**
 * Surface primitive. Standardises the `bg-slate-900 / border-slate-800 /
 * rounded-lg` card that pages were each writing by hand.
 */

export function Card({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg border border-slate-800 bg-slate-900 shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-4 ${className}`}
    >
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-6 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex items-center justify-end gap-2 border-t border-slate-800 px-6 py-4 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
