/**
 * Single fetch wrapper for the app's own API.
 * Replaces the ~30 hand-rolled `fetch("/api/v1/…")` + `res.json().catch(() => ({}))`
 * blocks that were copy-pasted across pages.
 */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Fallback error message when the server doesn't return one. */
  errorMessage?: string;
};

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, errorMessage } = opts;
  const res = await fetch(path, {
    method,
    ...(body !== undefined
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(
      data.error ?? errorMessage ?? `Request failed (${res.status})`,
      res.status,
    );
  }
  return res.json() as Promise<T>;
}
