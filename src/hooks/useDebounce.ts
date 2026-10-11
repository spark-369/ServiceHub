"use client";

import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value`. Used to stop the search box firing a
 * request on every keystroke (the home page previously refetched per character).
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
