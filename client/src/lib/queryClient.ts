import { QueryClient, QueryFunction } from "@tanstack/react-query";

function getAdminApiKey() {
  if (typeof window === "undefined") return "dev-admin-key";
  return window.localStorage.getItem("adminApiKey") || "dev-admin-key";
}

function getAdminUserEmail() {
  if (typeof window === "undefined") return "admin@local";
  return window.localStorage.getItem("adminUserEmail") || "admin@local";
}

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

function buildHeaders(url: string, hasBody: boolean) {
  const headers: Record<string, string> = {};
  if (hasBody) headers["Content-Type"] = "application/json";
  if (url.startsWith("/api") && !url.startsWith("/api/uploads")) {
    headers["x-admin-api-key"] = getAdminApiKey();
    headers["x-admin-user-email"] = getAdminUserEmail();
  }
  return headers;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
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
    headers: buildHeaders(scopedUrl, Boolean(data)),
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
      headers: buildHeaders(url, false),
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
