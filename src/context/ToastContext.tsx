"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Toast notifications.
 *
 * Replaces the native `alert()` calls that blocked the thread and broke the
 * dark aesthetic. The visual variants reuse the in-map alert styling from
 * `LocationMap` so feedback looks the same everywhere.
 */

export type ToastVariant = "info" | "success" | "warning" | "error";

interface Toast {
  id: number;
  variant: ToastVariant;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

const VARIANTS: Record<
  ToastVariant,
  { container: string; icon: string; text: string; symbol: string }
> = {
  info: {
    container: "border-blue-500/30",
    icon: "text-blue-400",
    text: "text-blue-200",
    symbol: "ℹ",
  },
  success: {
    container: "border-emerald-500/30",
    icon: "text-emerald-400",
    text: "text-emerald-200",
    symbol: "✓",
  },
  warning: {
    container: "border-amber-500/30",
    icon: "text-amber-400",
    text: "text-amber-200",
    symbol: "⚠",
  },
  error: {
    container: "border-red-500/30",
    icon: "text-red-400",
    text: "text-red-200",
    symbol: "✕",
  },
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = nextId++;
      setToasts((current) => [...current, { id, variant, message }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (message: string) => toast(message, "success"),
      error: (message: string) => toast(message, "error"),
      info: (message: string) => toast(message, "info"),
      warning: (message: string) => toast(message, "warning"),
    }),
    [toast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Live region so assistive tech announces new toasts. */}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((item) => {
          const style = VARIANTS[item.variant];
          return (
            <div
              key={item.id}
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-slate-900/95 px-4 py-3 shadow-lg backdrop-blur ${style.container}`}
            >
              <span className={`mt-0.5 text-sm ${style.icon}`} aria-hidden="true">
                {style.symbol}
              </span>
              <p className={`flex-1 text-sm ${style.text}`}>{item.message}</p>
              <button
                onClick={() => dismiss(item.id)}
                className="text-slate-500 transition-colors hover:text-slate-300"
              >
                <span className="sr-only">Dismiss</span>
                <svg
                  className="h-4 w-4"
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
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
