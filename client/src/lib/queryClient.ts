import { QueryClient, QueryFunction } from "@tanstack/react-query";

function getActiveAssociationId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("activeAssociationId") || "";
}

const associationScopeExclusions = [
  "/api/dashboard",
  "/api/associations",
  "/api/admin",
  "/api/analysis",
  "/api/roadmap",
  "/api/uploads",
];

function maybeApplyAssociationScope(rawUrl: string, method: string): string {
  if (method.toUpperCase() !== "GET") return rawUrl;
  if (!rawUrl.startsWith("/api/")) return rawUrl;
  if (associationScopeExclusions.some((prefix) => rawUrl.startsWith(prefix))) return rawUrl;

  const associationId = getActiveAssociationId();
  if (!associationId) return rawUrl;

  const hasQuery = rawUrl.includes("?");
  const separator = hasQuery ? "&" : "?";
  if (rawUrl.includes("associationId=")) return rawUrl;
  return `${rawUrl}${separator}associationId=${encodeURIComponent(associationId)}`;
}

function buildHeaders(hasBody: boolean) {
  const headers: Record<string, string> = {};
  if (hasBody) headers["Content-Type"] = "application/json";
  return headers;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let parsed: { code?: string; detail?: string; message?: string } | null = null;
    try {
      parsed = text ? JSON.parse(text) as { code?: string; detail?: string; message?: string } : null;
    } catch {
      parsed = null;
    }

    if (
      typeof window !== "undefined"
      && res.status === 403
      && parsed?.code === "ADMIN_SESSION_REQUIRED"
      && window.location.pathname.startsWith("/app")
    ) {
      window.location.assign("/");
    }

    const message = parsed?.message || text;
    const detail = parsed?.detail ? ` (${parsed.detail})` : "";
    const code = parsed?.code ? ` [${parsed.code}]` : "";
    throw new Error(`${res.status}: ${message}${code}${detail}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const scopedUrl = maybeApplyAssociationScope(url, method);
  const res = await fetch(scopedUrl, {
    method,
    headers: buildHeaders(Boolean(data)),
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const rawUrl = queryKey.join("/") as string;
    const url = maybeApplyAssociationScope(rawUrl, "GET");
    const res = await fetch(url, {
      headers: buildHeaders(false),
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const bodyPreview = (await res.text()).slice(0, 120);
      throw new Error(`Expected JSON from ${url}, got ${contentType || "unknown"} (${bodyPreview})`);
    }
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
