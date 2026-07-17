import { useQuery } from "@tanstack/react-query";

export type FounderFeedbackIdentity = {
  email: string;
  surface: "admin" | "portal" | "session";
};

export type FounderFeedbackEligibility = {
  eligible: boolean;
  identity: FounderFeedbackIdentity | null;
};

function getPortalAccessId(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("portalAccessId") || "";
}

/**
 * William-only contextual feedback (2026-07-17).
 *
 * Single source of truth, client-side, for "is the current session eligible
 * to see the feedback button." The server resolves identity from whichever
 * session exists (admin cookie, portal header, or a general authenticated
 * session) and checks it against the allowlist in server/founder-feedback.ts
 * — this hook never decides eligibility itself, it only surfaces the
 * server's answer. Shared by both AdminContextualFeedbackWidget (admin
 * surface) and FounderFeedbackWidget (portal + public surfaces) so the two
 * floating buttons never disagree about who should see them.
 */
export function useFounderFeedbackEligibility() {
  return useQuery<FounderFeedbackEligibility>({
    queryKey: ["/api/feedback/eligible", "founder-feedback"],
    queryFn: async () => {
      const portalAccessId = getPortalAccessId();
      const res = await fetch("/api/feedback/eligible", {
        credentials: "include",
        headers: portalAccessId ? { "x-portal-access-id": portalAccessId } : undefined,
      });
      if (!res.ok) return { eligible: false, identity: null };
      return (await res.json()) as FounderFeedbackEligibility;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
