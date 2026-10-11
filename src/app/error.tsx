"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

/**
 * Global error boundary for unhandled client/render errors.
 * In production the raw message is hidden; users get a recovery action.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report to the console; swap for your monitoring SDK in production.
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 shadow-lg rounded-lg p-8 text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-500/10">
          <svg
            className="h-6 w-6 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-100">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Please try again.
        </p>
        {error.digest && (
          <p className="mt-1 text-xs text-slate-500">Reference: {error.digest}</p>
        )}
        <Button onClick={reset} className="mt-6">
          Try again
        </Button>
      </div>
    </div>
  );
}
