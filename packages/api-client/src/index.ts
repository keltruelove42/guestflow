export type ApiClientOptions = {
  baseUrl: string;
  getToken?: () => string | null | Promise<string | null>;
  fetch?: typeof fetch;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createApiClient(opts: ApiClientOptions) {
  const doFetch = opts.fetch ?? fetch;

  async function request<T>(
    path: string,
    init?: RequestInit & { json?: unknown },
  ): Promise<T> {
    const headers = new Headers(init?.headers);
    const token = opts.getToken ? await opts.getToken() : null;
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (init?.json !== undefined) {
      headers.set("Content-Type", "application/json");
    }
    const res = await doFetch(`${opts.baseUrl}${path}`, {
      ...init,
      headers,
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    });
    if (!res.ok) {
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = await res.text();
      }
      throw new ApiError(res.status, `API ${res.status}: ${path}`, body);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return {
    request,
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, json?: unknown) =>
      request<T>(path, { method: "POST", json }),
    patch: <T>(path: string, json?: unknown) =>
      request<T>(path, { method: "PATCH", json }),
    delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),

    // Thin typed helpers — expand as API routes land (M1+)
    auth: {
      demoLogin: (email: string, name?: string) =>
        request<{ token: string; user: { id: string; email: string; name: string | null; orgId: string } }>(
          "/api/v1/auth/demo",
          { method: "POST", json: { email, name } },
        ),
      me: () =>
        request<{ id: string; email: string; name: string | null; orgId: string; orgMode: string }>(
          "/api/v1/auth/me",
        ),
    },
    properties: {
      list: () => request<unknown[]>("/api/v1/properties"),
    },
    leads: {
      list: (qs?: string) => request<unknown[]>(`/api/v1/leads${qs ? `?${qs}` : ""}`),
      get: (id: string) => request<unknown>(`/api/v1/leads/${id}`),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
