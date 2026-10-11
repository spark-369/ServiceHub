"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";

/**
 * Declarative data fetching for client components: runs `apiFetch(path)` on
 * mount (and when `path`/`enabled` change), exposing loading/error/data plus a
 * manual `refetch`. Removes the repeated try/catch/finally boilerplate that
 * every page previously carried.
 */
export function useApi<T>(
  path: string | null,
  { enabled = true }: { enabled?: boolean } = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path) && enabled);
  const [error, setError] = useState<string | null>(null);

  // Guards against setting state after unmount / out-of-order responses.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!path || !enabled) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<T>(path);
      if (id === requestId.current) setData(result);
    } catch (err) {
      if (id === requestId.current) {
        setError(err instanceof ApiError ? err.message : "Something went wrong");
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [path, enabled]);

  useEffect(() => {
    void load();
    return () => {
      // Invalidate any in-flight response for this effect run.
      requestId.current++;
    };
  }, [load]);

  return { data, loading, error, refetch: load };
}
