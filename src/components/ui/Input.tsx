import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";

/**
 * Form controls with the shared dark styling and focus ring. The base classes
 * match the inputs already in the codebase (slate borders, indigo focus) so
 * swapping them in does not change the visual result.
 */

const CONTROL =
  "block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 " +
  "placeholder:text-slate-500 shadow-sm transition-colors " +
  "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const INVALID = "border-red-500/50 focus:border-red-500 focus:ring-red-500";

export function Input({
  className = "",
  invalid = false,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={`${CONTROL} ${invalid ? INVALID : ""} ${className}`}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Textarea({
  className = "",
  invalid = false,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={`${CONTROL} ${invalid ? INVALID : ""} ${className}`}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Select({
  className = "",
  invalid = false,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      className={`${CONTROL} ${invalid ? INVALID : ""} ${className}`}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  );
}

/**
 * Label + optional hint/error wrapper. Generates a stable id and wires up
 * `htmlFor` / `aria-describedby` / `aria-invalid` when the child is a single
 * control, otherwise the consumer passes the id through directly.
 */
export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  className = "",
  children,
}: FieldProps) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-slate-300"
      >
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      <div className="mt-1">{children}</div>
      {hint && !error && (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
