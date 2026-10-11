import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import Spinner from "./Spinner";

/**
 * The one button in the design system. Visual variants reproduce the palette
 * that was previously copy-pasted across pages, so migrating a page to
 * `<Button>` is a visual no-op.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 " +
  "disabled:opacity-50 disabled:pointer-events-none";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500",
  secondary:
    "border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700",
  ghost: "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200",
  danger:
    "border border-red-500/30 bg-slate-800 text-red-300 hover:bg-red-500/10",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

function classes(variant: ButtonVariant, size: ButtonSize, extra = ""): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables interaction while an action is in flight. */
  loading?: boolean;
  className?: string;
  children: ReactNode;
}

export interface ButtonProps
  extends CommonProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> {}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={classes(variant, size, className)}
      {...rest}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends CommonProps {
  href: string;
  /** Set for external links so the correct rel attributes are applied. */
  external?: boolean;
}

/** A `next/link` styled identically to {@link Button}. */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  external = false,
  children,
}: ButtonLinkProps) {
  const props = external
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};
  return (
    <Link href={href} className={classes(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
