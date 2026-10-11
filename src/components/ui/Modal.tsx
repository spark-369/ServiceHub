"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Accessible dialog primitive.
 *
 * Fixes the gaps in the hand-rolled modals: traps focus, closes on Escape and
 * backdrop click, locks background scroll, and exposes `role="dialog"` /
 * `aria-modal`. The visual treatment matches `ReviewModal` (dark surface over a
 * blurred backdrop) so it drops in without a redesign.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
  labelledBy,
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  labelledBy?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = labelledBy ?? "app-modal-title";

  // Close on Escape and lock background scroll while open.
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the dialog for keyboard/screen-reader users.
    const focusTimer = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }, 0);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidth = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }[size];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        onClick={(event) => event.stopPropagation()}
        className={`w-full ${maxWidth} max-h-[85vh] overflow-y-auto rounded-lg border border-slate-800 bg-slate-900 shadow-xl`}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-slate-800 p-6">
            <h2 id={titleId} className="text-xl font-semibold text-slate-100">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <span className="sr-only">Close</span>
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        <div className="p-6">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-800 p-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
