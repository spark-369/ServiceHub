/**
 * Thin browser API client.
 *
 * Centralises the Bearer-token header, JSON serialisation and error
 * normalisation that every page previously hand-rolled around `fetch`. Never
 * import this from a server component — it reads the token from `localStorage`.
 */

/** Error thrown for any non-2xx API response, carrying the HTTP status. */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  /** Plain object serialised to JSON (mutually exclusive with a raw body). */
  body?: unknown;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("token");
  } catch {
    return null;
  }
}

/**
 * Performs a JSON fetch, attaching the auth token when present, and throws an
 * {@link ApiError} on failure. Returns the parsed body typed as `T`.
 */
export async function apiFetch<T = unknown>(
  path: string,
  { body, headers, ...init }: ApiFetchOptions = {}
): Promise<T> {
  const token = getToken();

  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers as Record<string, string> | undefined),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : null) || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return data as T;
}
